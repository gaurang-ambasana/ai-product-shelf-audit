import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIResponsesModel } from "@/lib/config";
import type { LiveSimResult } from "@/lib/analysis/live-sim";
import type { Response } from "openai/resources/responses/responses";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

function parseJsonObject(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(t.slice(start, end + 1)) as unknown;
    }
    throw new Error("No JSON object in model output");
  }
}

function normalizeHost(h: string): string {
  return h.replace(/^www\./i, "").trim().toLowerCase();
}

function hostFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return normalizeHost(new URL(url.trim()).hostname);
  } catch {
    return null;
  }
}

function primaryMatchesPick(primary: string, storeLabel: string, url: string | null): boolean {
  const p = normalizeHost(primary);
  const label = normalizeHost(storeLabel);
  const u = hostFromUrl(url);
  if (label && (label === p || label.endsWith(`.${p}`) || p.endsWith(`.${label}`))) return true;
  if (u && (u === p || u.endsWith(`.${p}`) || p.endsWith(`.${u}`))) return true;
  return false;
}

const rawPickSchema = z.object({
  rank: z.number().int().min(1).max(10),
  storeLabel: z.string(),
  productTitle: z.string(),
  productId: z.string().nullable().optional(),
  url: z.string().nullable(),
  reason: z.string(),
});

const llmResponseSchema = z.object({
  prompt: z.string(),
  picks: z.array(rawPickSchema).max(8),
});

/** Prefer variety: avoid filling the list with many listings from the same retailer. */
function diversifyPicks(
  picks: z.infer<typeof rawPickSchema>[],
  maxPerHostname: number,
): z.infer<typeof rawPickSchema>[] {
  const sorted = [...picks].sort((a, b) => a.rank - b.rank);
  const count = new Map<string, number>();
  const out: z.infer<typeof rawPickSchema>[] = [];
  for (const pick of sorted) {
    const host = normalizeHost(pick.storeLabel) || hostFromUrl(pick.url) || "unknown";
    const n = count.get(host) ?? 0;
    if (n >= maxPerHostname) continue;
    count.set(host, n + 1);
    out.push(pick);
    if (out.length >= 5) break;
  }
  return out.map((p, i) => ({ ...p, rank: i + 1 }));
}

async function webSearchPicksForPrompt(opts: {
  prompt: string;
  primaryStoreLabel: string;
  region: string;
  category?: string;
}): Promise<LiveSimResult> {
  const { prompt, primaryStoreLabel, region, category } = opts;
  const client = getClient();
  const model = getOpenAIResponsesModel();

  const input = `Shopper-style question: "${prompt}"
Region: ${region}. Category hint: ${category ?? "unspecified"}.

Audited store hostname (do NOT favor it unless web results genuinely rank it best for this question): ${primaryStoreLabel}

Use web search to see which retailers, marketplaces, and product pages actually surface for this question.

Then output ONLY valid JSON (no markdown, no text before or after) with exactly this shape:
{
  "prompt": string (echo the shopper question),
  "picks": [
    {
      "rank": 1,
      "storeLabel": "hostname only, e.g. amazon.in or myshop.com",
      "productTitle": "concise title as a shopper would see it",
      "productId": null,
      "url": "https://... if you have a concrete page URL from results, otherwise null",
      "reason": "one short sentence tied to what you saw in search results"
    }
  ]
}

Rules:
- picks must have 3 to 5 items when the web shows enough variety; fewer is OK if results are thin.
- Prefer DISTINCT shopping hostnames (different retailers or marketplaces). Do not output five rows all from ${primaryStoreLabel} unless search results truly only surface that domain for this query.
- rank 1 = best answer to the question among what you found, not "our client first".
- productId must be null (web discovery, not catalog IDs).
- Do not invent URLs; use null if unsure.
- storeLabel must be the retail site hostname, not a brand slogan.`;

  let text = "";
  try {
    const resp = (await client.responses.create({
      model,
      input,
      instructions:
        "You are an impartial shopping SERP analyst. Use the web_search tool. Final assistant message must be raw JSON only, parseable by JSON.parse.",
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 3200,
      stream: false,
    })) as Response;

    text = resp.output_text?.trim() ?? "";
  } catch {
    return {
      prompt,
      picks: [],
      yourProductShown: false,
      yourBestRank: null,
      winnerStoreLabel: null,
    };
  }

  if (!text) {
    return {
      prompt,
      picks: [],
      yourProductShown: false,
      yourBestRank: null,
      winnerStoreLabel: null,
    };
  }

  let parsed: z.infer<typeof llmResponseSchema>;
  try {
    const json = parseJsonObject(text);
    const pr = llmResponseSchema.safeParse(json);
    if (!pr.success || pr.data.picks.length === 0) {
      return {
        prompt,
        picks: [],
        yourProductShown: false,
        yourBestRank: null,
        winnerStoreLabel: null,
      };
    }
    parsed = pr.data;
  } catch {
    return {
      prompt,
      picks: [],
      yourProductShown: false,
      yourBestRank: null,
      winnerStoreLabel: null,
    };
  }

  const diversified = diversifyPicks(parsed.picks, 1);
  const picks = diversified.map((p) => ({
    rank: p.rank,
    storeLabel: p.storeLabel.trim(),
    productTitle: p.productTitle.trim(),
    productId: null as string | null,
    url: p.url?.trim() || null,
    reason: p.reason.trim(),
    imageUrl: null as string | null,
    imageAlt: null as string | null,
  }));

  const yourRows = picks.filter((p) =>
    primaryMatchesPick(primaryStoreLabel, p.storeLabel, p.url),
  );
  const yourBestRank = yourRows.length ? Math.min(...yourRows.map((p) => p.rank)) : null;
  const winnerStoreLabel = picks[0]?.storeLabel ?? null;

  return {
    prompt: parsed.prompt.trim() || prompt,
    picks,
    yourProductShown: yourRows.length > 0,
    yourBestRank,
    winnerStoreLabel,
  };
}

const NOTE =
  "These rows use live web search (OpenAI web_search) for each regional discovery question—not a reorder of your crawl. Titles and hostnames follow what surfaced in retrieved results at this moment; they are not official Google or ChatGPT rankings.";

/**
 * Live-style “top picks” per prompt using real web search, shaped like crawl-based live sim for the same UI.
 */
export async function runLiveStyleWebSearch(opts: {
  prompts: string[];
  primaryStoreLabel: string;
  region: string;
  category?: string;
}): Promise<{ results: LiveSimResult[]; note: string }> {
  const slice = opts.prompts;
  const results = await Promise.all(
    slice.map((prompt) =>
      webSearchPicksForPrompt({
        prompt,
        primaryStoreLabel: opts.primaryStoreLabel,
        region: opts.region,
        category: opts.category,
      }),
    ),
  );
  return { results, note: NOTE };
}
