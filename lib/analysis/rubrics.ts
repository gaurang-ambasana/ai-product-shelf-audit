import type { DiscoveredProduct } from "@/lib/types/crawl";
import type { ScoreBreakdown } from "@/lib/types/report";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Deterministic subscores from crawl evidence only */
export function scoreProductRubric(p: DiscoveredProduct): ScoreBreakdown {
  const desc = p.descriptionText.length;
  const semanticClarity = clamp(
    (desc > 400 ? 40 : desc / 10) +
      (p.title.length > 8 ? 20 : 10) +
      (p.evidence.specs.length > 2 ? 25 : 10) +
      (p.evidence.faqCount > 0 || p.evidence.hasFaqSchema ? 15 : 0),
  );

  let meta = 0;
  if (p.evidence.metaDescription && p.evidence.metaDescription.length > 40) meta += 35;
  if (p.evidence.ogDescription && p.evidence.ogDescription.length > 30) meta += 25;
  if (p.evidence.ogTitle) meta += 15;
  if (p.images.length > 0) meta += 15;
  const metadataCompleteness = clamp(meta + p.evidence.imageAltCoverage * 10);

  let structured = 0;
  if (p.evidence.hasProductSchema) structured += 40;
  if (p.evidence.hasOffer) structured += 25;
  if (p.evidence.hasAggregateRating) structured += 20;
  if (p.evidence.hasFaqSchema) structured += 15;
  const structuredData = clamp(structured);

  const retrievalFriendliness = clamp(
    semanticClarity * 0.35 +
      structuredData * 0.25 +
      (p.evidence.specs.length > 0 ? 20 : 0) +
      (p.evidence.jsonLdTypes.length > 0 ? 20 : 0),
  );

  const comparisonReadiness = clamp(
    (p.evidence.specs.length > 4 ? 45 : p.evidence.specs.length * 8) +
      (p.priceMin != null ? 25 : 0) +
      (p.descriptionText.length > 300 ? 30 : 15),
  );

  let trust = 30;
  if (p.evidence.hasAggregateRating) trust += 35;
  if (p.evidence.reviewSignal === "widget_heuristic") trust += 25;
  if (p.evidence.reviewSignal === "none") trust -= 10;
  const trustSignals = clamp(trust);

  return {
    semanticClarity,
    metadataCompleteness,
    structuredData,
    retrievalFriendliness,
    comparisonReadiness,
    trustSignals,
    contentUniqueness: 70,
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
  "Your overall score mixes two things: how complete and trustworthy your listings look (titles, details, reviews, images), and how well your wording lines up with everyday shopping questions. Listing quality counts a bit more than the shopping-question match.";
