import type { AppErrorCode } from "@/lib/errors/types";

export type NormalizeResult =
  | { ok: true; origin: string; href: string }
  | { ok: false; code: AppErrorCode };

export function normalizeStoreUrl(raw: string): NormalizeResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, code: "INVALID_URL" };
  let urlStr = trimmed;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return { ok: false, code: "INVALID_URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, code: "INVALID_URL" };
  }
  if (u.hostname.length < 3 || !u.hostname.includes(".")) {
    return { ok: false, code: "INVALID_URL" };
  }
  const origin = `${u.protocol}//${u.host}`;
  const href = origin + "/";
  return { ok: true, origin, href };
}
