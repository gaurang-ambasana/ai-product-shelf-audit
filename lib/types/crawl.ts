import { z } from "zod";

export const pageEvidenceSchema = z.object({
  jsonLdTypes: z.array(z.string()),
  hasProductSchema: z.boolean(),
  hasOffer: z.boolean(),
  hasAggregateRating: z.boolean(),
  hasFaqSchema: z.boolean(),
  metaDescription: z.string().nullable(),
  ogTitle: z.string().nullable(),
  ogDescription: z.string().nullable(),
  faqCount: z.number(),
  reviewSignal: z.enum(["aggregate_in_schema", "widget_heuristic", "none"]),
  imageAltCoverage: z.number(),
  specs: z.array(z.string()),
});

export type PageEvidence = z.infer<typeof pageEvidenceSchema>;

export const discoveredProductSchema = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  /** Shopify `product_type` when available; otherwise null */
  category: z.string().nullable(),
  url: z.string(),
  descriptionText: z.string(),
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  currency: z.string().nullable(),
  images: z.array(
    z.object({
      url: z.string(),
      alt: z.string().nullable(),
    }),
  ),
  evidence: pageEvidenceSchema,
});

export type DiscoveredProduct = z.infer<typeof discoveredProductSchema>;

export const storeCrawlSchema = z.object({
  label: z.enum(["primary", "competitor"]),
  inputUrl: z.string(),
  origin: z.string(),
  platform: z.enum(["shopify", "unknown"]),
  products: z.array(discoveredProductSchema),
  errors: z.array(z.string()),
});

export type StoreCrawl = z.infer<typeof storeCrawlSchema>;

export const crawlResultSchema = z.object({
  version: z.literal(1),
  fetchedAt: z.string(),
  primary: storeCrawlSchema,
  competitors: z.array(storeCrawlSchema),
});

export type CrawlResult = z.infer<typeof crawlResultSchema>;
