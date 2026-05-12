import type { DiscoveredProduct } from "@/lib/types/crawl";
import type { ScoreBreakdown } from "@/lib/types/report";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Deterministic subscores from crawl evidence only */
export function scoreProductRubric(p: DiscoveredProduct): ScoreBreakdown {
  const desc = p.descriptionText.length;
  const semanticClarity = clamp(
    (desc > 400 ? 32 : desc / 12) +
      (p.title.length > 8 ? 16 : 8) +
      (p.evidence.specs.length > 2 ? 20 : 8) +
      (p.evidence.faqCount > 0 || p.evidence.hasFaqSchema ? 12 : 0),
  );

  let meta = 0;
  if (p.evidence.metaDescription && p.evidence.metaDescription.length > 40) meta += 30;
  if (p.evidence.ogDescription && p.evidence.ogDescription.length > 30) meta += 22;
  if (p.evidence.ogTitle) meta += 12;
  if (p.images.length > 0) meta += 12;
  const metadataCompleteness = clamp(meta + p.evidence.imageAltCoverage * 8);

  let structured = 0;
  if (p.evidence.hasProductSchema) structured += 34;
  if (p.evidence.hasOffer) structured += 22;
  if (p.evidence.hasAggregateRating) structured += 18;
  if (p.evidence.hasFaqSchema) structured += 12;
  const structuredData = clamp(structured);

  const retrievalFriendliness = clamp(
    semanticClarity * 0.33 +
      structuredData * 0.24 +
      (p.evidence.specs.length > 0 ? 16 : 0) +
      (p.evidence.jsonLdTypes.length > 0 ? 16 : 0),
  );

  const comparisonReadiness = clamp(
    (p.evidence.specs.length > 4 ? 38 : p.evidence.specs.length * 7) +
      (p.priceMin != null ? 22 : 0) +
      (p.descriptionText.length > 300 ? 26 : 12),
  );

  let trust = 22;
  if (p.evidence.hasAggregateRating) trust += 32;
  if (p.evidence.reviewSignal === "widget_heuristic") trust += 22;
  if (p.evidence.reviewSignal === "none") trust -= 12;
  const trustSignals = clamp(trust);

  return {
    semanticClarity,
    metadataCompleteness,
    structuredData,
    retrievalFriendliness,
    comparisonReadiness,
    trustSignals,
    contentUniqueness: 52,
  };
}

export function averageBreakdown(bs: ScoreBreakdown[]): ScoreBreakdown {
  if (!bs.length) {
    return {
      semanticClarity: 0,
      metadataCompleteness: 0,
      structuredData: 0,
      retrievalFriendliness: 0,
      comparisonReadiness: 0,
      trustSignals: 0,
      contentUniqueness: 0,
    };
  }
  const keys = Object.keys(bs[0]) as (keyof ScoreBreakdown)[];
  const out = {} as ScoreBreakdown;
  for (const k of keys) {
    const v = bs.reduce((s, x) => s + x[k], 0) / bs.length;
    out[k] = Math.round(v);
  }
  return out;
}

export const WEIGHTS_NOTE =
  "Your overall score mixes listing completeness (titles, details, reviews, images) with how well your wording lines up with sample shopping questions. Similarity scores use a calibrated scale so strong embedding matches do not automatically read as “near perfect.” Listing quality counts a bit more than the question match.";
