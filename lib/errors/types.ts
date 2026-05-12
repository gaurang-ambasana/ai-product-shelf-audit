export type AppErrorCode =
  | "BAD_REQUEST"
  | "INVALID_URL"
  | "CRAWL_FAILED"
  | "CRAWL_TIMEOUT"
  | "SHOPIFY_UNAVAILABLE"
  | "OPENAI_ERROR"
  | "ANALYSIS_FAILED"
  | "STREAM_ERROR"
  | "INTERNAL";

export type PublicErrorBody = {
  code: AppErrorCode;
  message: string;
  requestId?: string;
};
