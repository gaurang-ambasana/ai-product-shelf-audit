export const SHOPIFY_PRODUCTS_PAGE_LIMIT = 15;
export const DEFAULT_MAX_PRODUCTS = 75;
export const MAX_SELECTED_PRODUCTS = 5;
export const MAX_HTML_ENRICH = 40;
export const CRAWL_TIMEOUT_MS = 25_000;

export function getMaxProducts(): number {
  const raw = process.env.MAX_PRODUCTS;
  if (!raw) return DEFAULT_MAX_PRODUCTS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : DEFAULT_MAX_PRODUCTS;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

export function getEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}
