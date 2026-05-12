import type { AppErrorCode } from "./types";

const MAP: Record<AppErrorCode, string> = {
  BAD_REQUEST: "Something didn’t work with those details. Double-check what you entered and try again.",
  INVALID_URL: "That doesn’t look like a full website link. Paste your store’s home page, starting with https://",
  CRAWL_FAILED: "We couldn’t read this store well enough. The site may block automated visits, or products may be hidden.",
  CRAWL_TIMEOUT: "Loading this store took too long. Try again, or try a store with fewer products.",
  SHOPIFY_UNAVAILABLE: "We couldn’t load this store’s public product list. Make sure it’s a normal Shopify shop with a public catalog.",
  OPENAI_ERROR: "The writing assistant is temporarily busy. Please try again in a minute.",
  ANALYSIS_FAILED: "We couldn’t finish your report. Please try again in a moment.",
  STREAM_ERROR: "The connection dropped while loading results. Please try again.",
  INTERNAL: "Something went wrong on our side. Please try again in a moment.",
};

export function toUserMessage(code: AppErrorCode): string {
  return MAP[code] ?? MAP.INTERNAL;
}
