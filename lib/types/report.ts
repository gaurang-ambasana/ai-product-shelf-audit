import { z } from "zod";
import { crawlResultSchema } from "./crawl";

export const scoreBreakdownSchema = z.object({
  semanticClarity: z.number(),
  metadataCompleteness: z.number(),
  structuredData: z.number(),
  retrievalFriendliness: z.number(),
  comparisonReadiness: z.number(),
  trustSignals: z.number(),
  contentUniqueness: z.number(),
});

export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const promptSimSchema = z.object({
  prompt: z.string(),
  similarity: z.number(),
  topChunkPreview: z.string(),
});

export const productVisibilitySchema = z.object({
  productId: z.string(),
  title: z.string(),
  overall: z.number(),
  /** First product image from crawl (for report UI) */
  imageUrl: z.string().nullable().optional(),
  imageAlt: z.string().nullable().optional(),
  breakdown: scoreBreakdownSchema,
  perPrompt: z.array(promptSimSchema),
  gaps: z.array(z.string()),
  quickWins: z.array(z.string()),
});

export const brandQueryRankSchema = z.object({
  query: z.string(),
  brandScore: z.number(),
  rankAmong: z.number().nullable(),
  leaderHint: z.string().nullable(),
});

export const simulationPromptResultSchema = z.object({
  prompt: z.string(),
  rankings: z.array(
    z.object({
      label: z.string(),
      score: z.number(),
      isPrimaryBrand: z.boolean(),
    }),
  ),
});

/** One researched shopper query (web search via Responses API). */
export const promptWebResearchItemSchema = z.object({
  prompt: z.string(),
  intent: z.enum(["brand", "shopping"]),
  analysis: z.string(),
  sources: z.array(z.object({ url: z.string(), title: z.string().optional() })),
});

export type PromptWebResearchItem = z.infer<typeof promptWebResearchItemSchema>;

/** Dynamically generated shopper queries + live web-backed research per query. */
export const realWorldPromptResearchSchema = z.object({
  disclaimer: z.string(),
  brandIntentPrompts: z.array(z.string()),
  shoppingIntentPrompts: z.array(z.string()),
  brandIntentResults: z.array(promptWebResearchItemSchema),
  shoppingIntentResults: z.array(promptWebResearchItemSchema),
});

export type RealWorldPromptResearch = z.infer<typeof realWorldPromptResearchSchema>;

/** Short copy mapping live web research to each report tab (generated from research excerpts). */
export const realWorldWebResearchSynopsisSchema = z.object({
  overview: z.string(),
  assistantFitPanel: z.string(),
  competitionPanel: z.string(),
  dataGapsPanel: z.string(),
  nextStepsPanel: z.string(),
});

export type RealWorldWebResearchSynopsis = z.infer<typeof realWorldWebResearchSynopsisSchema>;

export const auditReportV1Schema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  storeUrl: z.string(),
  categoryHint: z.string().nullable(),
  regionHint: z.string().nullable(),
  luxuryHint: z.boolean(),
  disclaimer:
    z.string(),
  overallScore: z.number(),
  overallBreakdown: scoreBreakdownSchema,
  weightsNote: z.string(),
  brandAiSearchRank: z.object({
    composite: z.number(),
    /** Average rank across sample questions (1 is best). */
    avgRank: z.number().nullable().optional(),
    /** Number of stores compared (including you) when rank is available. */
    comparedStoreCount: z.number().nullable().optional(),
    perQuery: z.array(brandQueryRankSchema),
    strongestQueries: z.array(z.string()),
    weakestQueries: z.array(z.string()),
  }),
  products: z.array(productVisibilitySchema),
  simulation: z.array(simulationPromptResultSchema),
  /** OpenAI-picked results from crawled candidates (not live web). */
  liveSimulation: z
    .object({
      note: z.string(),
      results: z.array(
        z.object({
          prompt: z.string(),
          yourProductShown: z.boolean(),
          yourBestRank: z.number().nullable(),
          winnerStoreLabel: z.string().nullable(),
          picks: z.array(
            z.object({
              rank: z.number(),
              storeLabel: z.string(),
              productTitle: z.string(),
              productId: z.string().nullable(),
              url: z.string().nullable(),
              reason: z.string(),
              imageUrl: z.string().nullable().optional(),
              imageAlt: z.string().nullable().optional(),
            }),
          ),
        }),
      ),
    })
    .nullable()
    .optional(),
  /** Model-suggested well-known brands per discovery prompt (not from crawl). */
  marketBrandSignals: z
    .array(
      z.object({
        prompt: z.string(),
        names: z.array(z.string()),
      }),
    )
    .optional(),
  marketBrandDisclaimer: z.string().optional(),
  competitorSummary: z.string().nullable(),
  catalogGaps: z.array(z.string()),
  recommendations: z.array(z.string()),
  rewrites: z.array(
    z.object({
      productId: z.string(),
      title: z.string(),
      imageUrl: z.string().nullable().optional(),
      imageAlt: z.string().nullable().optional(),
      suggestedTitle: z.string(),
      bullets: z.array(z.string()),
      description: z.string(),
      faqIdeas: z.array(z.string()),
      schemaTips: z.array(z.string()),
    }),
  ),
  technicalAudit: z.object({
    jsonLdSummary: z.string(),
    metaSummary: z.string(),
    mediaSummary: z.string(),
    crawlNotes: z.array(z.string()),
  }),
  measurementAppendix: z.array(z.string()),
  /** Optional: dynamic shopper queries + web search research (Responses API). */
  realWorldPromptResearch: realWorldPromptResearchSchema.optional(),
  /** Optional: short panel blurbs derived from live web research when present. */
  realWorldWebResearchSynopsis: realWorldWebResearchSynopsisSchema.optional(),
});

export type AuditReportV1 = z.infer<typeof auditReportV1Schema>;

export const analyzeRequestSchema = z.object({
  crawl: crawlResultSchema,
  selectedProductIds: z.array(z.string()).min(1).max(5),
  category: z.string().optional(),
  region: z.string().min(1, "Choose a region so prompts match where your customers shop."),
  luxury: z.boolean().optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
