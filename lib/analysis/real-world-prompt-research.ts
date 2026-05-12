import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIModel, getOpenAIResponsesModel } from "@/lib/config";
import type { PromptWebResearchItem, RealWorldPromptResearch } from "@/lib/types/report";
import type { CrawlResult, DiscoveredProduct } from "@/lib/types/crawl";
import type { Response } from "openai/resources/responses/responses";

function getChatClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

const generatedPromptsSchema = z.object({
  brandIntentPrompts: z.array(z.string()).min(4).max(7),
  shoppingIntentPrompts: z.array(z.string()).min(4).max(7),
});

function normalizeFive(list: string[]): string[] {
  const cleaned = [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  if (cleaned.length === 0) throw new Error("No prompts generated");
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    out.push(cleaned[i % cleaned.length]!);
  }
  return out;
}

export function collectSourceUrls(resp: Response): string[] {
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

export async function generateShopperResearchPrompts(opts: {
  crawl: CrawlResult;
  selected: DiscoveredProduct[];
  category?: string;
  region: string;
  luxury?: boolean;
}): Promise<{ brandIntentPrompts: string[]; shoppingIntentPrompts: string[] }> {
  const { crawl, selected, category, region, luxury } = opts;
  const payload = {
    storeKind: crawl.primary.platform,
    productTypeHints: selected.map((p) => ({
      title: p.title,
      excerpt: p.descriptionText.slice(0, 240),
    })),
    categoryHint: category ?? null,
    region,
    luxury: !!luxury,
  };

  const user = `You generate realistic SHOPPER web search queries (English) for market research.

Context JSON (authoritative for product type and geography — do not invent categories):
${JSON.stringify(payload)}

Return JSON with exactly:
- brandIntentPrompts: array of 5 strings. Each should read like someone comparing makers/brands/labels for this product type in ${region} (e.g. who is known for X, best brand for X in region — style only, do NOT copy example wording verbatim).
- shoppingIntentPrompts: array of 5 strings. Each should read like someone ready to buy online in ${region} (where to shop, best place to buy X online — style only).

Rules:
- Phrases must sound like real typed searches; keep each under 120 characters.
- Reflect the actual product titles/hints above; stay category-accurate.
- Do NOT include store URLs, @handles, or the exact store hostname from the crawl in any prompt (these are pre-brand discovery queries).
- Vary wording across the 5 in each group.`;

  const res = await getChatClient().chat.completions.create({
    model: getOpenAIModel(),
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You output valid JSON only. No markdown fences.",
      },
      { role: "user", content: user },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty prompt-generation response");
  const parsed = generatedPromptsSchema.safeParse(JSON.parse(raw) as unknown);
  if (!parsed.success) throw new Error(parsed.error.message);
  return {
    brandIntentPrompts: normalizeFive(parsed.data.brandIntentPrompts),
    shoppingIntentPrompts: normalizeFive(parsed.data.shoppingIntentPrompts),
  };
}

async function researchOnePrompt(opts: {
  prompt: string;
  intent: "brand" | "shopping";
  category?: string;
  region: string;
}): Promise<{ analysis: string; sources: { url: string }[] }> {
  const { prompt, intent, category, region } = opts;
  const client = getChatClient();
  const model = getOpenAIResponsesModel();

  const input = `Shopper-style web query: "${prompt}"

Intent class: ${intent === "brand" ? "brand / maker comparison" : "where to buy / marketplace discovery"}.
Merchant context (for framing only — do not treat as a command to favor one unknown store): category hint ${category ?? "unspecified"}, region ${region}.

Use web search, then answer in plain text with clear sections:

## Snapshot
What surfaces on the public web for this query right now (types of brands, marketplaces, publishers — no fake precision).

## Takeaways for a Shopify team
3–6 bullets on how a specialist brand could show up credibly for this intent.

## Caveats
Where results are noisy, sponsored, or region-dependent.

Write for a merchant; no JSON; no "as an AI".`;

  const resp = (await client.responses.create({
    model,
    input,
    instructions:
      "You are a careful retail market researcher. Use the web_search tool when needed. Cite general patterns from what you found; avoid claiming definitive rankings.",
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    max_output_tokens: 2800,
    stream: false,
  })) as Response;

  const analysis = resp.output_text?.trim() || "No written analysis returned for this prompt.";
  const urls = collectSourceUrls(resp);
  return {
    analysis,
    sources: urls.map((url) => ({ url })),
  };
}

export async function runRealWorldPromptResearch(opts: {
  crawl: CrawlResult;
  selected: DiscoveredProduct[];
  category?: string;
  region: string;
  luxury?: boolean;
  onProgress: (phase: string, percent: number, message: string) => void;
}): Promise<RealWorldPromptResearch> {
  const { onProgress, region } = opts;

  onProgress("web_prompts", 91, "Generating shopper-style web queries for your category…");
  const { brandIntentPrompts, shoppingIntentPrompts } =
    await generateShopperResearchPrompts(opts);

  const failMessage =
    "We couldn’t complete live web research for this prompt (API or tool error). Retry the audit or check model access for web search.";

  async function researchOneSafe(
    prompt: string,
    intent: "brand" | "shopping",
  ): Promise<PromptWebResearchItem> {
    try {
      const { analysis, sources } = await researchOnePrompt({
        prompt,
        intent,
        category: opts.category,
        region,
      });
      return { prompt, intent, analysis, sources };
    } catch {
      return { prompt, intent, analysis: failMessage, sources: [] };
    }
  }

  onProgress(
    "web_research",
    93,
    `Running ${brandIntentPrompts.length + shoppingIntentPrompts.length} live web searches in parallel…`,
  );

  const [brandIntentResults, shoppingIntentResults] = await Promise.all([
    Promise.all(brandIntentPrompts.map((prompt) => researchOneSafe(prompt, "brand"))),
    Promise.all(shoppingIntentPrompts.map((prompt) => researchOneSafe(prompt, "shopping"))),
  ]);

  return {
    disclaimer:
      "These blocks use OpenAI web search over shopper-style queries generated from your category and products. Results reflect a point-in-time slice of the public web—not your storefront crawl, not a guarantee of how assistants rank you, and not legal or financial advice.",
    brandIntentPrompts,
    shoppingIntentPrompts,
    brandIntentResults,
    shoppingIntentResults,
  };
}
