/**
 * Plain-language labels for store owners, marketing, and sales (not engineers).
 */

export const PROGRESS_PHASE_LABELS: Record<string, string> = {
  Crawl: "Gathering products",
  Analyze: "Building your report",
  detect: "Checking your store",
  products_json: "Loading your product list",
  discover: "Finding product pages",
  enrich: "Reading product details",
  store: "Working on each store",
  chunk: "Organizing what we found",
  embed: "Studying your product wording",
  uniqueness: "Seeing how different each product sounds",
  rubric: "Checking listing quality",
  brand_rank: "Testing typical shopper questions",
  simulation: "Sample shopping questions",
  llm: "Writing clear takeaways",
  web_prompts: "Drafting shopper web queries",
  web_research: "Searching the live web",
  web_discovery_rank: "Checking the open web for your discovery prompts",
  central_insights: "Writing your unified agentShop insights",
  done: "Finishing up",
};

export function progressPhaseLabel(phase: string): string {
  return PROGRESS_PHASE_LABELS[phase] ?? phase.replace(/_/g, " ");
}

export const SCORE_DIMENSION_LABELS = {
  semanticClarity: "Clear product story",
  metadataCompleteness: "Titles & short previews",
  structuredData: "Rich product details",
  retrievalFriendliness: "Easy for smart shopping tools",
  comparisonReadiness: "Specs & pricing clarity",
  trustSignals: "Reviews & trust",
  contentUniqueness: "Stands out in your catalog",
} as const;
