const UA =
  "Mozilla/5.0 (compatible; AIShelfAudit/1.0; +https://vercel.com) AppleWebKit/537.36";

export async function fetchText(
  url: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*" },
    signal,
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}
