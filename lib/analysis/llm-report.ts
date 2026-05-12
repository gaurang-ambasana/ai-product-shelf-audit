import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIModel } from "@/lib/config";
import type { CrawlResult, DiscoveredProduct } from "@/lib/types/crawl";
import type { AuditReportV1 } from "@/lib/types/report";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

const llmSchema = z.object({
  perProductGaps: z.array(z.array(z.string())),
  perProductWins: z.array(z.array(z.string())),
  competitorSummary: z.string().nullable(),
  catalogGaps: z.array(z.string()),
  recommendations: z.array(z.string()),
  rewrites: z.array(
    z.object({
      productId: z.string(),
      suggestedTitle: z.string(),
      bullets: z.array(z.string()),
      description: z.string(),
      faqIdeas: z.array(z.string()),
      schemaTips: z.array(z.string()),
    }),
  ),
  technicalJsonLdSummary: z.string(),
  technicalMetaSummary: z.string(),
  technicalMediaSummary: z.string(),
  measurementAppendix: z.array(z.string()),
});

export type ProductVisLite = {
  productId: string;
  title: string;
  overall: number;
  breakdown: Record<string, number>;
};

function evidencePayload(
  crawl: CrawlResult,
  selected: DiscoveredProduct[],
  productVis: ProductVisLite[],
) {
  return {
    store: crawl.primary.origin,
    platform: crawl.primary.platform,
    productCount: crawl.primary.products.length,
    crawlErrors: crawl.primary.errors,
    competitors: crawl.competitors.map((c) => ({
      origin: c.origin,
      productSample: c.products.slice(0, 5).map((p) => ({
        title: p.title,
        handle: p.handle,
      })),
    })),
    selected: selected.map((p) => ({
      id: p.id,
      title: p.title,
      url: p.url,
      descriptionExcerpt: p.descriptionText.slice(0, 1200),
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      currency: p.currency,
      evidence: p.evidence,
    })),
    scores: productVis,
  };
}

export async function generateLlmSections(opts: {
  crawl: CrawlResult;
  selected: DiscoveredProduct[];
  productVis: ProductVisLite[];
  category?: string;
  region?: string;
  luxury?: boolean;
}): Promise<{
  perProductGaps: string[][];
  perProductWins: string[][];
  competitorSummary: string | null;
  catalogGaps: string[];
  recommendations: string[];
  rewrites: AuditReportV1["rewrites"];
  technicalAudit: AuditReportV1["technicalAudit"];
  measurementAppendix: string[];
}> {
  const { crawl, selected, productVis, category, region, luxury } = opts;
  const payload = evidencePayload(crawl, selected, productVis);
  const model = getOpenAIModel();

  const user = `Context (JSON, authoritative — do not invent facts not present here):
${JSON.stringify(payload)}

User hints: category=${category ?? "unspecified"}, region=${region ?? "unspecified"}, luxury=${luxury ?? false}

Return a JSON object with:
- perProductGaps: string[][] — same length as selected products, each 3-6 short gaps grounded in evidence; write for a store owner, no jargon (no "JSON-LD", "embeddings", "schema")
- perProductWins: string[][] — same length, 2-4 quick wins each; plain language
- competitorSummary: string or null — 2-4 sentences describing what kinds of brands or makers shoppers in the given REGION might commonly hear about for this CATEGORY when asking an AI assistant (general market picture). Do not reference pasted competitor URLs (there are none). Null only if you truly have no safe answer.
- catalogGaps: 4-8 bullets for the whole catalog crawl; merchant-friendly
- recommendations: 6-10 prioritized actions to improve listings and trust; avoid saying "SEO" unless clearly about search snippets—prefer "product page", "listing", "shoppers"
- rewrites: array parallel to selected products (same order), each with productId matching, suggestedTitle, bullets (4-6), description (2-4 sentences), faqIdeas (3-5), schemaTips (2-4) — schemaTips should say "structured product data" or "product details for Google/shopping" not raw technical names
- technicalJsonLdSummary, technicalMetaSummary, technicalMediaSummary: short paragraphs from evidence only, readable for a non-developer
- measurementAppendix: 4-8 bullets explaining what was looked at in simple terms (no fake precision)

If data is missing, say "unknown" for that item — never fabricate reviews or product data not shown in the context.`;

  const res = await getClient().chat.completions.create({
    model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write product listing audits for online stores. Output valid JSON only. Use plain language for merchants. Never claim live Google rankings or results inside ChatGPT or other apps.",
      },
      { role: "user", content: user },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty LLM response");
  }
  let parsed: z.infer<typeof llmSchema>;
  try {
    const json = JSON.parse(raw) as unknown;
    const pr = llmSchema.safeParse(json);
    if (!pr.success) {
      throw new Error(pr.error.message);
    }
    parsed = pr.data;
  } catch {
    throw new Error("LLM JSON parse failed");
  }

  const rewrites = selected.map((p, i) => {
    const rw = parsed.rewrites[i];
    return {
      productId: p.id,
      title: p.title,
      suggestedTitle: rw?.suggestedTitle ?? p.title,
      bullets: rw?.bullets ?? [],
      description: rw?.description ?? "",
      faqIdeas: rw?.faqIdeas ?? [],
      schemaTips: rw?.schemaTips ?? [],
    };
  });

  const fallbackGap = [
    "We couldn’t spot more detail from the pages we read—try adding clearer specs, pricing, and photos.",
  ];
  const fallbackWin = [
    "Tighten the title, add bullet-point specs, and fill in short summaries where they’re blank.",
  ];

  return {
    perProductGaps: selected.map(
      (_, i) => parsed.perProductGaps[i] ?? fallbackGap,
    ),
    perProductWins: selected.map(
      (_, i) => parsed.perProductWins[i] ?? fallbackWin,
    ),
    competitorSummary: parsed.competitorSummary,
    catalogGaps: parsed.catalogGaps,
    recommendations: parsed.recommendations,
    rewrites,
    technicalAudit: {
      jsonLdSummary: parsed.technicalJsonLdSummary,
      metaSummary: parsed.technicalMetaSummary,
      mediaSummary: parsed.technicalMediaSummary,
      crawlNotes: [
        ...crawl.primary.errors,
        ...crawl.competitors.flatMap((c) => c.errors),
      ],
    },
    measurementAppendix: parsed.measurementAppendix,
  };
}
