import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIModel } from "@/lib/config";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

/** Fallback when LLM is unavailable — region-focused “discovery” style prompts. */
export function buildRegionalFallbackPrompts(opts: {
  region: string;
  category?: string;
  luxury?: boolean;
}): string[] {
  const r = opts.region.trim();
  const c = (opts.category?.trim() || "products in this niche").toLowerCase();
  const lux = opts.luxury ? "premium " : "";
  return [
    `Top ${lux}${c} brands in ${r}`,
    `Best ${c} makers and sellers in ${r}`,
    `Leading ${c} companies shoppers trust in ${r}`,
    `Most recommended ${lux}${c} brands for buyers in ${r}`,
    `Top-rated ${c} manufacturers and brands in ${r}`,
    `Who makes the best ${c} in ${r}`,
    `Best value ${c} brands available in ${r}`,
    `Emerging ${c} brands to watch in ${r}`,
    `Where to buy quality ${c} in ${r}`,
  ];
}

const responseSchema = z.object({
  prompts: z.array(z.string().min(8)).min(8).max(10),
});

/**
 * 8–9 short, region-specific discovery prompts (e.g. “top … in …”) tailored to
 * category and store context — not fixed copy from the examples.
 */
export async function generateRegionalDiscoveryPrompts(opts: {
  region: string;
  category?: string;
  luxury?: boolean;
  storeHostname: string;
  sampleProductTitles: string[];
}): Promise<string[]> {
  const fallback = buildRegionalFallbackPrompts(opts);
  const region = opts.region.trim();
  const category = opts.category?.trim() || "general retail";
  const samples = opts.sampleProductTitles.slice(0, 5).join("; ") || "(none)";

  try {
    const res = await getClient().chat.completions.create({
      model: getOpenAIModel(),
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write short shopper questions for an AI assistant. Output JSON only with key \"prompts\": array of 9 strings. Each prompt must be 8–18 words, end with or include the target region, and sound like real discovery questions (top brands, best makers, trusted sellers, where to buy). Vary wording. Do not include URLs, @handles, or competitor store names the user pasted. Do not copy example industries verbatim—adapt to the given category.",
        },
        {
          role: "user",
          content: `Store site: ${opts.storeHostname}
Product category hint: ${category}
Target region (required in every prompt): ${region}
Luxury positioning: ${opts.luxury ? "yes" : "no"}
Sample product titles from this store: ${samples}

Return {"prompts":[...9 strings...]}`,
        },
      ],
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return fallback.slice(0, 9);
    const json = JSON.parse(raw) as unknown;
    const pr = responseSchema.safeParse(json);
    if (!pr.success) return fallback.slice(0, 9);
    const out = pr.data.prompts
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 9);
    if (out.length < 8) return fallback.slice(0, 9);
    return out.length === 9 ? out : [...out, ...fallback].slice(0, 9);
  } catch {
    return fallback.slice(0, 9);
  }
}
