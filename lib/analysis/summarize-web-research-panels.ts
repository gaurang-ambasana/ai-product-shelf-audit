import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIModel } from "@/lib/config";
import type { RealWorldPromptResearch } from "@/lib/types/report";
import { realWorldWebResearchSynopsisSchema } from "@/lib/types/report";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

function compactResearch(research: RealWorldPromptResearch) {
  const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 520);
  return {
    disclaimer: research.disclaimer,
    brand: research.brandIntentResults.map((r) => ({
      query: r.prompt,
      excerpt: clip(r.analysis),
    })),
    shopping: research.shoppingIntentResults.map((r) => ({
      query: r.prompt,
      excerpt: clip(r.analysis),
    })),
  };
}

/**
 * Turns long per-query web write-ups into short, panel-specific merchant copy
 * (no repetition of full analyses in the UI).
 */
export async function summarizeWebResearchForPanels(
  research: RealWorldPromptResearch,
): Promise<z.infer<typeof realWorldWebResearchSynopsisSchema>> {
  const payload = compactResearch(research);
  const model = getOpenAIModel();

  const user = `You are editing an audit report for a Shopify merchant.

Below is JSON from "live web research": ten real shopper-style web searches (5 brand/maker intent, 5 where-to-buy intent) plus short excerpts of what was found. The full text is NOT shown in the app—you must capture the *meaning* for different report tabs.

Input JSON:
${JSON.stringify(payload)}

Return a single JSON object with these keys (plain sentences, merchant-friendly, no markdown, no bullet characters inside strings):
- overview: 2-3 sentences. What this web pass adds to the report overall, and how to read it alongside offline scores.
- assistantFitPanel: 2-4 sentences. What the "Assistant fit" tab measures (listing wording vs sample questions, product cards) and how the BRAND-intent web excerpts inform that story—without repeating long lists.
- competitionPanel: 2-4 sentences. What the "Competition" tab shows (other crawled stores, charts, market names) and how SHOPPING-intent + brand-intent web excerpts inform competitive context—stay humble about guarantees.
- dataGapsPanel: 2-4 sentences. What "Data gaps" measures (catalog completeness, structured data, trust signals) and what web excerpts suggest shoppers or publishers expect to see.
- nextStepsPanel: 2-4 sentences. How the "Next steps" tab (recommendations, rewrites) should be read in light of both offline scores and web themes—action-oriented, not repetitive of other fields.

Do not invent store names or rankings not implied by the excerpts.`;

  const res = await getClient().chat.completions.create({
    model,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You output valid JSON only. You never claim verified assistant rankings. You stay concise and non-jargony.",
      },
      { role: "user", content: user },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty web synopsis response");
  const pr = realWorldWebResearchSynopsisSchema.safeParse(JSON.parse(raw) as unknown);
  if (!pr.success) throw new Error(pr.error.message);
  return pr.data;
}
