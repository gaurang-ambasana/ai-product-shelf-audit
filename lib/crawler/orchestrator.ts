import * as cheerio from "cheerio";
import {
  CRAWL_TIMEOUT_MS,
  getMaxProducts,
  MAX_HTML_ENRICH,
} from "@/lib/config";
import type { AppErrorCode } from "@/lib/errors/types";
import type {
  CrawlResult,
  DiscoveredProduct,
  StoreCrawl,
} from "@/lib/types/crawl";
import { extractPageEvidence } from "./extractors/page-evidence";
import { extractProductPricingFromHtml } from "./extract-product-pricing";
import { fetchText } from "./fetch-html";
import { normalizeStoreUrl } from "./normalize-url";
import { fetchRenderedHtml } from "./playwright";
import {
  detectShopify,
  pricesFromProduct,
  stripHtml,
  tryFetchShopifyCartCurrency,
  tryFetchShopifyProductsPage,
  type ShopifyJsonProduct,
} from "./shopify";

export type CrawlProgress = {
  type: "progress";
  phase: string;
  percent: number;
  message: string;
  storeIndex?: number;
  storeTotal?: number;
};

export type CrawlStreamOut =
  | CrawlProgress
  | { type: "error"; code: AppErrorCode }
  | { type: "result"; data: CrawlResult };

function emptyStore(
  label: StoreCrawl["label"],
  inputUrl: string,
  origin: string,
): StoreCrawl {
  return {
    label,
    inputUrl,
    origin,
    platform: "unknown",
    products: [],
    errors: [],
  };
}

async function discoverGenericProductUrls(
  origin: string,
  max: number,
  onStatus: (s: string) => void,
): Promise<string[]> {
  const home = `${origin}/`;
  let html: string;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), CRAWL_TIMEOUT_MS);
  const r = await fetchText(home, ac.signal);
  clearTimeout(t);
  if (!r.ok) {
    onStatus("The home page didn’t load the usual way; trying a fuller page view…");
    try {
      html = await fetchRenderedHtml(home, CRAWL_TIMEOUT_MS);
    } catch {
      return [];
    }
  } else {
    html = r.text;
  }

  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (!href.includes("/products/")) return;
    try {
      const u = new URL(href, origin);
      if (u.origin !== new URL(origin).origin) return;
      const path = u.pathname.replace(/\/$/, "");
      if (!path.includes("/products/")) return;
      urls.add(`${origin}${path}`);
    } catch {
      /* */
    }
  });
  return [...urls].slice(0, max);
}

async function enrichProduct(
  p: DiscoveredProduct,
  usePlaywrightFallback: boolean,
): Promise<DiscoveredProduct> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), CRAWL_TIMEOUT_MS);
  let html: string | null = null;
  try {
    const r = await fetchText(p.url, ac.signal);
    clearTimeout(t);
    if (r.ok) html = r.text;
  } catch {
    clearTimeout(t);
  }

  if (!html && usePlaywrightFallback) {
    try {
      html = await fetchRenderedHtml(p.url, CRAWL_TIMEOUT_MS);
    } catch {
      html = null;
    }
  }

  if (!html) return p;

  const evidence = extractPageEvidence(html);
  const pricing = extractProductPricingFromHtml(html);

  let priceMin = p.priceMin;
  let priceMax = p.priceMax;
  let currency = p.currency;

  if (currency == null && pricing.currency != null) {
    currency = pricing.currency;
  }
  if (priceMin == null && pricing.priceMin != null) {
    priceMin = pricing.priceMin;
  }
  if (priceMax == null && pricing.priceMax != null) {
    priceMax = pricing.priceMax;
  }
  if (priceMin != null && priceMax == null && pricing.priceMax != null) {
    priceMax = pricing.priceMax;
  }
  if (priceMax != null && priceMin == null && pricing.priceMin != null) {
    priceMin = pricing.priceMin;
  }

  return { ...p, priceMin, priceMax, currency, evidence };
}

function fromShopifyJson(
  origin: string,
  sp: ShopifyJsonProduct,
  shopPresentmentCurrency: string | null,
): DiscoveredProduct {
  const { min, max, currency } = pricesFromProduct(sp);
  const resolvedCurrency = currency ?? shopPresentmentCurrency;
  const bodyHtml = sp.body_html ?? "";
  const blankEvidence = extractPageEvidence(
    `<html><title>${sp.title}</title><body>${bodyHtml}</body></html>`,
  );
  const cat = sp.product_type?.trim();
  return {
    id: String(sp.id),
    handle: sp.handle,
    title: sp.title,
    category: cat && cat.length > 0 ? cat : null,
    url: `${origin}/products/${sp.handle}`,
    descriptionText: stripHtml(bodyHtml).slice(0, 8000),
    priceMin: min,
    priceMax: max,
    currency: resolvedCurrency,
    images: (sp.images ?? []).slice(0, 12).map((im) => ({
      url: im.src,
      alt: im.alt ?? null,
    })),
    evidence: blankEvidence,
  };
}

async function crawlOneStore(opts: {
  label: StoreCrawl["label"];
  /** Shown in progress messages, e.g. "Your store" or "Comparison store 2" */
  friendlyName: string;
  inputUrl: string;
  maxProducts: number;
  globalPercent: (local: number) => number;
  emit: (e: CrawlStreamOut) => void;
}): Promise<StoreCrawl> {
  const { label, friendlyName, inputUrl, maxProducts, globalPercent, emit } = opts;
  const norm = normalizeStoreUrl(inputUrl);
  if (!norm.ok) {
    return { ...emptyStore(label, inputUrl, ""), errors: ["Invalid URL"] };
  }
  const { origin } = norm;
  const errors: string[] = [];
  const products: DiscoveredProduct[] = [];
  let platform: StoreCrawl["platform"] = "unknown";

  emit({
    type: "progress",
    phase: "detect",
    percent: globalPercent(5),
    message: `Checking ${friendlyName}…`,
  });

  const acDetect = new AbortController();
  const tDetect = setTimeout(() => acDetect.abort(), CRAWL_TIMEOUT_MS);
  const isShopify = await detectShopify(origin, acDetect.signal).catch(() => false);
  clearTimeout(tDetect);

  if (isShopify) {
    platform = "shopify";
    let shopPresentmentCurrency: string | null = null;
    try {
      const acCart = new AbortController();
      const tCart = setTimeout(() => acCart.abort(), CRAWL_TIMEOUT_MS);
      shopPresentmentCurrency = await tryFetchShopifyCartCurrency(origin, acCart.signal);
      clearTimeout(tCart);
    } catch {
      shopPresentmentCurrency = null;
    }

    let page = 1;
    while (products.length < maxProducts) {
      emit({
        type: "progress",
        phase: "products_json",
        percent: globalPercent(10 + (page / 8) * 25),
        message: `Loading more products (page ${page}) — ${friendlyName}…`,
      });
      const acPage = new AbortController();
      const tPage = setTimeout(() => acPage.abort(), CRAWL_TIMEOUT_MS);
      const r = await tryFetchShopifyProductsPage(origin, page, acPage.signal);
      clearTimeout(tPage);
      if (!r.ok) {
        if (page === 1)
          errors.push("Could not load the standard product list from this store’s public pages.");
        break;
      }
      if (r.products.length === 0) break;
      for (const sp of r.products) {
        if (products.length >= maxProducts) break;
        products.push(fromShopifyJson(origin, sp, shopPresentmentCurrency));
      }
      page += 1;
    }
  }

  if (!products.length) {
    emit({
      type: "progress",
      phase: "discover",
      percent: globalPercent(35),
      message: `Finding product pages — ${friendlyName}…`,
    });
    const urls = await discoverGenericProductUrls(origin, maxProducts, (m) =>
      emit({
        type: "progress",
        phase: "discover",
        percent: globalPercent(38),
        message: m,
      }),
    );
    for (const url of urls) {
      const path = new URL(url).pathname;
      const handle = path.split("/products/")[1]?.split("/")[0] ?? path;
      products.push({
        id: handle,
        handle,
        title: handle.replace(/-/g, " "),
        category: null,
        url,
        descriptionText: "",
        priceMin: null,
        priceMax: null,
        currency: null,
        images: [],
        evidence: extractPageEvidence("<html></html>"),
      });
    }
    if (!products.length) {
      errors.push("No product pages were found on this site.");
    }
  }

  const enrichN = Math.min(MAX_HTML_ENRICH, products.length);
  for (let i = 0; i < enrichN; i++) {
    const pct = 40 + (i / Math.max(enrichN, 1)) * 55;
    emit({
      type: "progress",
      phase: "enrich",
      percent: globalPercent(pct),
      message: `Reading product ${i + 1} of ${enrichN} — ${friendlyName}…`,
    });
    products[i] = await enrichProduct(products[i], platform !== "shopify");
  }

  return {
    label,
    inputUrl: norm.href,
    origin,
    platform,
    products,
    errors,
  };
}

export async function runCrawl(opts: {
  storeUrl: string;
  competitorUrls: string[];
  emit: (e: CrawlStreamOut) => void;
}): Promise<CrawlResult> {
  const maxProducts = getMaxProducts();
  const targets = [
    { url: opts.storeUrl, label: "primary" as const },
    ...opts.competitorUrls.map((url) => ({
      url,
      label: "competitor" as const,
    })),
  ];

  const competitors: StoreCrawl[] = [];
  let primary: StoreCrawl = emptyStore("primary", opts.storeUrl, "");

  for (let si = 0; si < targets.length; si++) {
    const { url, label } = targets[si];
    const friendlyName =
      label === "primary" ? "your store" : `comparison store ${si}`;
    const base = si / targets.length;
    const next = (si + 1) / targets.length;
    const globalPercent = (local: number) =>
      Math.round((base + (local / 100) * (next - base)) * 100);

    opts.emit({
      type: "progress",
      phase: "store",
      percent: globalPercent(0),
      message:
        label === "primary"
          ? "Starting with your store…"
          : `Adding comparison store ${si}…`,
      storeIndex: si + 1,
      storeTotal: targets.length,
    });

    const sc = await crawlOneStore({
      label,
      friendlyName,
      inputUrl: url,
      maxProducts,
      globalPercent,
      emit: opts.emit,
    });

    if (label === "primary") primary = sc;
    else competitors.push(sc);
  }

  const result: CrawlResult = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    primary,
    competitors,
  };

  opts.emit({ type: "result", data: result });
  return result;
}
