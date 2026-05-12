import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIResponsesModel } from "@/lib/config";
import type { Response } from "openai/resources/responses/responses";
import type { WebSearchDiscoveryRank, WebSearchDiscoveryRankRow } from "@/lib/types/report";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

function collectSourceUrls(resp: Response): string[] {
  const urls: string[] = [];
  for (const item of resp.output ?? []) {
    if (item.type !== "web_search_call") continue;
    const action = item.action;
    if (action.type === "search" && action.sources) {
      for (const s of action.sources) {
        if (s.type === "url" && s.url) urls.push(s.url);
      }
    }
  }
  return [...new Set(urls)];
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

const llmRowSchema = z.object({
  summary: z.string(),
  primaryMentioned: z.boolean(),
  primaryApproxRank: z.number().nullable().optional(),
  surfacedExamples: z
    .array(
      z.object({
        label: z.string(),
        url: z.string().nullable().optional(),
        note: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  caveats: z.string(),
});

const DEFAULT_DISCLAIMER =
  "Each query uses OpenAI web search over the public web (point in time). Rank and mentions are the model's read of retrieved sources—not an official Google or ChatGPT ranking, not guaranteed complete, and not legal or financial advice.";

const DEFAULT_NOTE =
  "We run up to five of your regional discovery prompts through live web search. The \"Live web picks\" section above shows structured retailer rows for the same questions; here you get a compact JSON-style read (approx rank for your hostname, surfaced examples, and caveats).";

function normalizeRow(
  prompt: string,
  raw: z.infer<typeof llmRowSchema>,
  sourceUrls: string[],
): WebSearchDiscoveryRankRow {
  let rank: number | null = raw.primaryApproxRank ?? null;
  if (!raw.primaryMentioned) rank = null;
  if (typeof rank === "number" && (!Number.isFinite(rank) || rank < 1 || rank > 15)) {
    rank = null;
  }
  return {
    prompt,
    summary: raw.summary.trim(),
    primaryMentioned: raw.primaryMentioned,
    primaryApproxRank: rank,
    surfacedExamples: (raw.surfacedExamples ?? []).slice(0, 8),
    caveats: raw.caveats.trim(),
    sourceUrls,
  };
}

async function researchOne(opts: {
  prompt: string;
  primaryHostname: string;
  primaryStoreLabel: string;
  sampleProductTitles: string[];
}): Promise<WebSearchDiscoveryRankRow> {
  const samples = opts.sampleProductTitles.slice(0, 5).join(" | ") || "(none)";
  const input = `Shopper-style discovery query: "${opts.prompt}"

Audited store hostname (treat www. as equivalent): ${opts.primaryHostname}
Display label: ${opts.primaryStoreLabel}
Sample product titles from this audit (context only; not evidence of ranking): ${samples}

Use web search to see what appears for this query on the public web right now.

Your entire final message must be one JSON object only (no markdown fences, no prose before or after) with exactly these keys:
- "summary": string, 2–5 sentences. Say what kinds of brands, retailers, or publishers dominate results. Explicitly state whether ${opts.primaryHostname} appears in substantive results you saw.
- "primaryMentioned": boolean — true only if ${opts.primaryHostname} (or obvious same-site pages) appears in substantive organic-style results you saw.
- "primaryApproxRank": number from 1 to 10 inclusive, or null — only when primaryMentioned is true, your best estimate of this store’s position among notable organic-style results; otherwise null.
- "surfacedExamples": array of up to 8 objects, each {"label": string, "url": string|null, "note": string} for other notable brands, retailers, or pages that showed up. Use null for url when unsure; do not invent URLs.
- "caveats": string, one sentence on ads, region, volatility, or why this is not identical to a live Google or ChatGPT answer.

Rules:
- Do not favor ${opts.primaryStoreLabel} because it is the audit subject.
- If the audited store is absent or only appears in ads, set primaryMentioned false and primaryApproxRank null.
- JSON only.`;

  const client = getClient();
  const model = getOpenAIResponsesModel();

  const resp = (await client.responses.create({
    model,
    input,
    instructions:
      "You are an impartial retail SERP analyst. Use the web_search tool. The user requires raw JSON only as the final assistant text, parseable by JSON.parse.",
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    max_output_tokens: 2600,
    stream: false,
  })) as Response;

  const text = resp.output_text?.trim() ?? "";
  const sourceUrls = collectSourceUrls(resp);

  if (!text) {
    return {
      prompt: opts.prompt,
      summary:
        "No written response returned after web search. Retry the audit or check model access.",
      primaryMentioned: false,
      primaryApproxRank: null,
      surfacedExamples: [],
      caveats: "Empty model output.",
      sourceUrls,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = parseJsonObject(text);
  } catch {
    return {
      prompt: opts.prompt,
      summary:
        "Web search ran, but the model did not return valid JSON. See caveats; you can retry the audit.",
      primaryMentioned: false,
      primaryApproxRank: null,
      surfacedExamples: [],
      caveats: text.slice(0, 400),
      sourceUrls,
    };
  }

  const pr = llmRowSchema.safeParse(parsedJson);
  if (!pr.success) {
    return {
      prompt: opts.prompt,
      summary:
        "Web search ran, but the JSON shape was unexpected. Retry the audit or check API behavior.",
      primaryMentioned: false,
      primaryApproxRank: null,
      surfacedExamples: [],
      caveats: pr.error.message.slice(0, 280),
      sourceUrls,
    };
  }

  return normalizeRow(opts.prompt, pr.data, sourceUrls);
}

/** Max discovery prompts to run through web search (cost / latency cap). */
export const WEB_SEARCH_DISCOVERY_RANK_MAX_PROMPTS = 5;

export async function runWebSearchDiscoveryRank(opts: {
  prompts: string[];
  primaryHostname: string;
  primaryStoreLabel: string;
  sampleProductTitles: string[];
  onProgress: (phase: string, percent: number, message: string) => void;
}): Promise<WebSearchDiscoveryRank> {
  const slice = opts.prompts.slice(0, WEB_SEARCH_DISCOVERY_RANK_MAX_PROMPTS);

  opts.onProgress(
    "web_discovery_rank",
    98,
    `Open web check: ${slice.length} discovery ${slice.length === 1 ? "query" : "queries"} in parallel…`,
  );

  const results = await Promise.all(
    slice.map(async (prompt) => {
      try {
        return await researchOne({
          prompt,
          primaryHostname: opts.primaryHostname,
          primaryStoreLabel: opts.primaryStoreLabel,
          sampleProductTitles: opts.sampleProductTitles,
        });
      } catch {
        return {
          prompt,
          summary:
            "Web search or the Responses API failed for this prompt (network, quota, or tool error). Retry the audit.",
          primaryMentioned: false,
          primaryApproxRank: null,
          surfacedExamples: [],
          caveats: "Request error.",
          sourceUrls: [],
        };
      }
    }),
  );

  return {
    disclaimer: DEFAULT_DISCLAIMER,
    note: DEFAULT_NOTE,
    results,
  };
}
