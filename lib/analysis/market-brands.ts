import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIModel } from "@/lib/config";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

const batchSchema = z.object({
  results: z.array(
    z.object({
      prompt: z.string(),
      /** Well-known brand or maker names a shopper might hear from an assistant — not verified live data */
      options: z.array(z.string()).max(6),
    }),
  ),
});

export type MarketBrandSignal = {
  prompt: string;
  names: string[];
};

/**
 * For each discovery prompt, ask the model which brands/makers are commonly associated
 * (general knowledge — not web search, not your crawl).
 */
export async function fetchMarketBrandSignalsForPrompts(
  prompts: string[],
): Promise<{ items: MarketBrandSignal[]; disclaimer: string }> {
  const disclaimer =
    "These names are typical suggestions from the model’s general knowledge—not live search, not your storefront crawl, and not guaranteed current rankings.";

  if (!prompts.length) return { items: [], disclaimer };

  try {
    const res = await getClient().chat.completions.create({
      model: getOpenAIModel(),
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Return JSON only: {"results":[{"prompt":string,"options":[string,...]}]} — one entry per input prompt, same order. "options" = 3–5 well-known brand or maker names a shopper might see suggested for that question. No URLs. If unsure, use fewer options.',
        },
        {
          role: "user",
          content: JSON.stringify({ prompts }),
        },
      ],
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return { items: [], disclaimer };
    const json = JSON.parse(raw) as unknown;
    const pr = batchSchema.safeParse(json);
    if (!pr.success) return { items: [], disclaimer };

    const rows = pr.data.results;
    const items: MarketBrandSignal[] = prompts.map((prompt, i) => {
      const row = rows[i];
      const rawNames =
        row && row.prompt === prompt
          ? row.options
          : row?.options ?? [];
      return {
        prompt,
        names: rawNames.map((s) => s.trim()).filter(Boolean),
      };
    });
    return { items, disclaimer };
  } catch {
    return { items: [], disclaimer };
  }
}
