import * as cheerio from "cheerio";

export type ParsedJsonLd = {
  types: string[];
  hasProduct: boolean;
  hasOffer: boolean;
  hasAggregateRating: boolean;
  hasFaqPage: boolean;
};

function walkTypes(node: unknown, acc: Set<string>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) walkTypes(x, acc);
    return;
  }
  const o = node as Record<string, unknown>;
  const t = o["@type"];
  if (typeof t === "string") acc.add(t);
  if (Array.isArray(t)) for (const x of t) if (typeof x === "string") acc.add(x);
  for (const k of Object.keys(o)) {
    walkTypes(o[k], acc);
  }
}

function detectFlags(node: unknown): Omit<ParsedJsonLd, "types"> {
  const types = new Set<string>();
  walkTypes(node, types);
  const typeList = [...types];
  const hasProduct = typeList.some((t) => t === "Product" || t.includes("Product"));
  const hasOffer = typeList.includes("Offer") || typeList.includes("AggregateOffer");
  const hasAggregateRating = typeList.includes("AggregateRating");
  const hasFaqPage = typeList.includes("FAQPage");
  return { hasProduct, hasOffer, hasAggregateRating, hasFaqPage };
}

export function parseJsonLdFromHtml(html: string): ParsedJsonLd {
  const $ = cheerio.load(html);
  const acc = new Set<string>();
  let flags = {
    hasProduct: false,
    hasOffer: false,
    hasAggregateRating: false,
    hasFaqPage: false,
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as unknown;
      walkTypes(data, acc);
      const f = detectFlags(data);
      flags = {
        hasProduct: flags.hasProduct || f.hasProduct,
        hasOffer: flags.hasOffer || f.hasOffer,
        hasAggregateRating: flags.hasAggregateRating || f.hasAggregateRating,
        hasFaqPage: flags.hasFaqPage || f.hasFaqPage,
      };
    } catch {
      /* ignore */
    }
  });
  return {
    types: [...acc],
    ...flags,
  };
}
