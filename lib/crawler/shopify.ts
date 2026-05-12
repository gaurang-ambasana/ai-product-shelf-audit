import { SHOPIFY_PRODUCTS_PAGE_LIMIT } from "@/lib/config";
import { fetchText } from "./fetch-html";

export type ShopifyJsonProduct = {
  id: number;
  title: string;
  handle: string;
  /** Shopify may send null when the description is empty */
  body_html: string | null;
  product_type?: string | null;
  variants: { price: string; title: string; currency?: string }[];
  images: { src: string; alt?: string | null }[];
};

type ProductsResponse = { products: ShopifyJsonProduct[] };

export async function tryFetchShopifyProductsPage(
  origin: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ ok: true; products: ShopifyJsonProduct[] } | { ok: false; status: number }> {
  const url = `${origin}/products.json?limit=${SHOPIFY_PRODUCTS_PAGE_LIMIT}&page=${page}`;
  const { ok, status, text } = await fetchText(url, signal);
  if (!ok) return { ok: false, status };
  try {
    const data = JSON.parse(text) as ProductsResponse;
    if (!data.products || !Array.isArray(data.products)) {
      return { ok: false, status: 500 };
    }
    return { ok: true, products: data.products };
  } catch {
    return { ok: false, status: 500 };
  }
}

export async function detectShopify(origin: string, signal?: AbortSignal): Promise<boolean> {
  const r = await tryFetchShopifyProductsPage(origin, 1, signal);
  return r.ok && r.products.length >= 0;
}

export function pricesFromProduct(p: ShopifyJsonProduct): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const nums = (p.variants ?? [])
    .map((v) => parseFloat(v.price))
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return { min: null, max: null, currency: null };
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    currency: p.variants[0]?.currency ?? null,
  };
}

export function stripHtml(html: string | null | undefined): string {
  const s = html ?? "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
