import * as cheerio from "cheerio";

export type ExtractedPricing = {
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
};

function addPrice(prices: number[], n: unknown) {
  const x = typeof n === "number" ? n : typeof n === "string" ? parseFloat(n.replace(/,/g, "")) : NaN;
  if (Number.isFinite(x)) prices.push(x);
}

function addCurrency(currencies: string[], c: unknown) {
  if (typeof c !== "string") return;
  const t = c.trim();
  if (t.length >= 2) currencies.push(t);
}

function consumeOfferLike(
  o: Record<string, unknown>,
  prices: number[],
  currencies: string[],
) {
  const typ = o["@type"];
  const types = Array.isArray(typ)
    ? typ.filter((x): x is string => typeof x === "string")
    : typeof typ === "string"
      ? [typ]
      : [];
  const cur = o.priceCurrency ?? o["pricecurrency"];
  const isAgg =
    types.includes("AggregateOffer") ||
    (typeof typ === "string" && typ === "AggregateOffer");
  const isOffer =
    types.includes("Offer") || (typeof typ === "string" && typ === "Offer");

  if (isAgg) {
    addPrice(prices, o.lowPrice);
    addPrice(prices, o.highPrice);
    addPrice(prices, o.price);
    addCurrency(currencies, cur);
  } else if (isOffer) {
    addPrice(prices, o.price);
    addCurrency(currencies, cur);
  }
}

function walkJsonLd(node: unknown, prices: number[], currencies: string[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) walkJsonLd(x, prices, currencies);
    return;
  }
  const o = node as Record<string, unknown>;
  const typ = o["@type"];
  const isProduct =
    typ === "Product" ||
    (Array.isArray(typ) && typ.includes("Product")) ||
    (typeof typ === "string" && typ.toLowerCase() === "product");

  if (isProduct) {
    const offers = o.offers ?? o["Offers"];
    if (offers && typeof offers === "object") {
      if (Array.isArray(offers)) {
        for (const off of offers) {
          if (off && typeof off === "object")
            consumeOfferLike(off as Record<string, unknown>, prices, currencies);
        }
      } else {
        consumeOfferLike(offers as Record<string, unknown>, prices, currencies);
      }
    }
  }

  const typesFlat = Array.isArray(typ)
    ? typ.filter((x): x is string => typeof x === "string")
    : typeof typ === "string"
      ? [typ]
      : [];
  if (
    typesFlat.includes("Offer") ||
    typesFlat.includes("AggregateOffer") ||
    typ === "Offer" ||
    typ === "AggregateOffer"
  ) {
    consumeOfferLike(o, prices, currencies);
  }

  for (const k of Object.keys(o)) walkJsonLd(o[k], prices, currencies);
}

function pickCurrency(currencies: string[]): string | null {
  if (!currencies.length) return null;
  const iso = currencies.find((c) => /^[A-Za-z]{3}$/.test(c));
  if (iso) return iso.toUpperCase();
  return currencies[0] ?? null;
}

/**
 * Best-effort price + ISO currency from product HTML (JSON-LD, Open Graph, common Shopify snippets).
 */
export function extractProductPricingFromHtml(html: string): ExtractedPricing {
  const prices: number[] = [];
  const currencies: string[] = [];

  const $ = cheerio.load(html);
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      walkJsonLd(JSON.parse(raw) as unknown, prices, currencies);
    } catch {
      /* ignore */
    }
  });

  const metaCur =
    $('meta[property="product:price:currency"]').attr("content")?.trim() ??
    $('meta[property="og:price:currency"]').attr("content")?.trim() ??
    $('meta[itemprop="priceCurrency"]').attr("content")?.trim() ??
    null;
  if (metaCur) addCurrency(currencies, metaCur);

  const m = html.match(/"priceCurrency"\s*:\s*"([A-Za-z]{3})"/);
  if (m?.[1]) addCurrency(currencies, m[1]);

  const shopifyCur = html.match(/Shopify\.currency\s*=\s*["']([A-Za-z]{3})["']/i);
  if (shopifyCur?.[1]) addCurrency(currencies, shopifyCur[1]);

  const priceMin = prices.length ? Math.min(...prices) : null;
  const priceMax = prices.length ? Math.max(...prices) : null;
  const currency = pickCurrency(currencies);

  return { priceMin, priceMax, currency };
}
