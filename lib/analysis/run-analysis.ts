import type { CrawlResult } from "@/lib/types/crawl";
import type { AuditReportV1 } from "@/lib/types/report";
import { buildBrandCorpusChunks, type TextChunk } from "./chunking";
import { cosineSimilarity, embedTexts, simToScore } from "./embeddings";
import { runLiveAiSimulation } from "./live-sim";
import { generateLlmSections } from "./llm-report";
import { generateRegionalDiscoveryPrompts } from "./curated-prompts";
import { fetchMarketBrandSignalsForPrompts } from "./market-brands";
import { runRealWorldPromptResearch } from "./real-world-prompt-research";
import { summarizeWebResearchForPanels } from "./summarize-web-research-panels";
import {
  averageBreakdown,
  scoreProductRubric,
  WEIGHTS_NOTE,
} from "./rubrics";

function maxSimForChunkIds(
  queryEmb: number[],
  ids: string[],
  chunkEmb: Map<string, number[]>,
  chunkTexts: Map<string, string>,
): { sim: number; preview: string } {
  let best = -1;
  let preview = "";
  for (const id of ids) {
    const emb = chunkEmb.get(id);
    if (!emb) continue;
    const sim = cosineSimilarity(queryEmb, emb);
    if (sim > best) {
      best = sim;
      preview = (chunkTexts.get(id) ?? "").slice(0, 160);
    }
  }
  return { sim: best === -1 ? 0 : best, preview };
}

function storeHostnameFromCrawl(inputUrl: string): string {
  try {
    return new URL(inputUrl).hostname.replace(/^www\./, "") || inputUrl;
  } catch {
    return inputUrl;
  }
}

function competitorLabel(
  c: CrawlResult["competitors"][0],
  idx: number,
): string {
  try {
    return (
      new URL(c.origin).hostname.replace(/^www\./, "") ||
      `Other store ${idx + 1}`
    );
  } catch {
    return `Other store ${idx + 1}`;
  }
}

function competitorSegments(
  crawl: CrawlResult,
): { label: string; start: number; end: number }[] {
  let off = 0;
  const segs: { label: string; start: number; end: number }[] = [];
  for (let i = 0; i < crawl.competitors.length; i++) {
    const comp = crawl.competitors[i];
    const n = buildBrandCorpusChunks(comp.products.slice(0, 20)).length;
    segs.push({
      label: competitorLabel(comp, i),
      start: off,
      end: off + n,
    });
    off += n;
  }
  return segs;
}

export async function runFullAnalysis(opts: {
  crawl: CrawlResult;
  selectedProductIds: string[];
  category?: string;
  region?: string;
  luxury?: boolean;
  onProgress: (phase: string, percent: number, message: string) => void;
}): Promise<AuditReportV1> {
  const { crawl, selectedProductIds, category, region, luxury } = opts;
  const regionTrim = region?.trim();
  if (!regionTrim) {
    throw new Error("Region is required for regional discovery prompts");
  }
  const primaryProducts = crawl.primary.products;
  const selected = primaryProducts.filter((p) =>
    selectedProductIds.includes(p.id),
  );
  if (!selected.length) {
    throw new Error("No matching selected products");
  }

  opts.onProgress("chunk", 5, "Pulling together your product descriptions and details…");
  const allChunks: TextChunk[] = buildBrandCorpusChunks(selected);
  const competitorChunks: TextChunk[] = crawl.competitors.flatMap((s) =>
    buildBrandCorpusChunks(s.products.slice(0, 20)),
  );
  const segs = competitorSegments(crawl);

  const chunkIdsByProduct = new Map<string, string[]>();
  for (const p of selected) {
    chunkIdsByProduct.set(
      p.id,
      allChunks.filter((c) => c.productId === p.id).map((c) => c.id),
    );
  }

  const chunkTexts = new Map(allChunks.map((c) => [c.id, c.text] as const));

  opts.onProgress("chunk", 8, "Building regional discovery prompts…");
  const regionalPrompts = await generateRegionalDiscoveryPrompts({
    region: regionTrim,
    category,
    luxury,
    storeHostname: storeHostnameFromCrawl(crawl.primary.inputUrl),
    sampleProductTitles: selected.map((p) => p.title),
  });

  opts.onProgress("embed", 15, "Reading your catalog wording in depth…");
  const toEmbed = [
    ...allChunks.map((c) => c.text),
    ...competitorChunks.map((c) => c.text),
    ...regionalPrompts,
  ];
  const embeddings = await embedTexts(toEmbed);
  let offset = 0;
  const take = (n: number) => {
    const part = embeddings.slice(offset, offset + n);
    offset += n;
    return part;
  };

  const selEmb = take(allChunks.length);
  const compEmb = take(competitorChunks.length);
  const promptEmb = take(regionalPrompts.length);

  const chunkEmb = new Map<string, number[]>();
  allChunks.forEach((c, i) => chunkEmb.set(c.id, selEmb[i]));
  competitorChunks.forEach((c, i) => chunkEmb.set(c.id, compEmb[i]));

  opts.onProgress("uniqueness", 45, "Checking how distinct each product sounds…");
  const uniqScores = new Map<string, number>();
  for (const p of selected) {
    const ids = chunkIdsByProduct.get(p.id) ?? [];
    const mainId = ids.find((id) => id.endsWith("-main"));
    if (!mainId) continue;
    const v = chunkEmb.get(mainId);
    if (!v) continue;
    let acc = 0;
    let n = 0;
    for (const oc of allChunks) {
      if (oc.productId === p.id) continue;
      const oe = chunkEmb.get(oc.id);
      if (!oe) continue;
      acc += cosineSimilarity(v, oe);
      n++;
    }
    const avgSim = n ? acc / n : 0;
    uniqScores.set(p.id, Math.round((1 - (avgSim + 1) / 2) * 100));
  }

  opts.onProgress("rubric", 55, "Scoring how complete each listing is…");
  const productVis = [];
  for (const p of selected) {
    const breakdown = scoreProductRubric(p);
    breakdown.contentUniqueness =
      uniqScores.get(p.id) ?? breakdown.contentUniqueness;
    const ids = chunkIdsByProduct.get(p.id) ?? [];

    const perPrompt = regionalPrompts.map((prompt, pi) => {
      const q = promptEmb[pi];
      const { sim, preview } = maxSimForChunkIds(
        q,
        ids,
        chunkEmb,
        chunkTexts,
      );
      return {
        prompt,
        similarity: simToScore(sim),
        topChunkPreview: preview,
      };
    });

    const retrievalAvg =
      perPrompt.reduce((s, x) => s + x.similarity, 0) / perPrompt.length;
    const rubricAvg =
      Object.values(breakdown).reduce((a, b) => a + b, 0) / 7;
    const overall = Math.round(rubricAvg * 0.55 + retrievalAvg * 0.45);

    const leadImg = p.images[0];
    productVis.push({
      productId: p.id,
      title: p.title,
      overall,
      imageUrl: leadImg?.url ?? null,
      imageAlt: leadImg?.alt ?? null,
      breakdown,
      perPrompt,
      gaps: [],
      quickWins: [],
    });
  }

  opts.onProgress("brand_rank", 65, "Seeing how your store fits common shopper questions…");
  const brandQueryRanks = regionalPrompts.map((q, qi) => {
    const qe = promptEmb[qi];
    let brandBest = 0;
    for (const e of selEmb) {
      brandBest = Math.max(brandBest, cosineSimilarity(qe, e));
    }
    const scores: { label: string; score: number; isYou: boolean }[] = [
      { label: "Your store", score: brandBest, isYou: true },
    ];
    for (let ci = 0; ci < segs.length; ci++) {
      const seg = segs[ci];
      let best = 0;
      for (let j = seg.start; j < seg.end; j++) {
        const emb = compEmb[j];
        if (!emb) continue;
        best = Math.max(best, cosineSimilarity(qe, emb));
      }
      scores.push({
        label: seg.label,
        score: best,
        isYou: false,
      });
    }
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const yourIndex = sorted.findIndex((s) => s.isYou);
    const rankAmong =
      crawl.competitors.length > 0 && yourIndex >= 0 ? yourIndex + 1 : null;
    const leader = sorted[0];
    return {
      query: q,
      brandScore: simToScore(brandBest),
      rankAmong,
      leaderHint:
        leader && !leader.isYou
          ? `In this sample, "${leader.label}" lines up most closely with this question.`
          : null,
    };
  });

  const compositeBrand =
    brandQueryRanks.reduce((s, x) => s + x.brandScore, 0) /
    brandQueryRanks.length;
  const sortedQ = [...brandQueryRanks].sort((a, b) => b.brandScore - a.brandScore);
  const strongestQueries = sortedQ.slice(0, 3).map((x) => x.query);
  const weakestQueries = sortedQ.slice(-3).map((x) => x.query);
  const avgRank =
    crawl.competitors.length > 0
      ? Math.round(
          (brandQueryRanks
            .map((q) => q.rankAmong)
            .filter((x): x is number => typeof x === "number")
            .reduce((s, x) => s + x, 0) /
            Math.max(
              1,
              brandQueryRanks.filter((q) => typeof q.rankAmong === "number")
                .length,
            )) * 10,
        ) / 10
      : null;
  const comparedStoreCount = crawl.competitors.length > 0 ? crawl.competitors.length + 1 : null;

  opts.onProgress("simulation", 72, "Scoring your picks against each discovery prompt…");
  const simulation = regionalPrompts.map((prompt, pi) => {
    const q = promptEmb[pi];
    const rankings: {
      label: string;
      score: number;
      isPrimaryBrand: boolean;
    }[] = [];

    let sum = 0;
    for (const p of selected) {
      const ids = chunkIdsByProduct.get(p.id) ?? [];
      const { sim } = maxSimForChunkIds(q, ids, chunkEmb, chunkTexts);
      sum += simToScore(sim);
    }
    rankings.push({
      label: "Your picks",
      score: Math.round(sum / selected.length),
      isPrimaryBrand: true,
    });

    for (let ci = 0; ci < segs.length; ci++) {
      const seg = segs[ci];
      let best = 0;
      for (let j = seg.start; j < seg.end; j++) {
        const emb = compEmb[j];
        if (!emb) continue;
        best = Math.max(best, cosineSimilarity(q, emb));
      }
      rankings.push({
        label: seg.label,
        score: simToScore(best),
        isPrimaryBrand: false,
      });
    }
    rankings.sort((a, b) => b.score - a.score);
    return { prompt, rankings };
  });

  const overallBreakdown = averageBreakdown(
    productVis.map((p) => p.breakdown),
  );
  const overallScore = Math.round(
    productVis.reduce((s, p) => s + p.overall, 0) / productVis.length,
  );

  opts.onProgress("llm", 82, "Turning results into plain-English tips…");
  const llm = await generateLlmSections({
    crawl,
    selected,
    productVis,
    category,
    region: regionTrim,
    luxury,
  });

  const disclaimer =
    "This is a practice run based only on your public store pages—not a live test inside ChatGPT, Google, or other apps. It estimates how clear and complete your products look to automated helpers.";

  const report: AuditReportV1 = {
    version: 1,
    generatedAt: new Date().toISOString(),
    storeUrl: crawl.primary.inputUrl,
    categoryHint: category ?? null,
    regionHint: regionTrim,
    luxuryHint: !!luxury,
    disclaimer,
    overallScore,
    overallBreakdown,
    weightsNote: WEIGHTS_NOTE,
    brandAiSearchRank: {
      composite: Math.round(compositeBrand),
      avgRank,
      comparedStoreCount,
      perQuery: brandQueryRanks,
      strongestQueries,
      weakestQueries,
    },
    products: productVis.map((pv, i) => ({
      ...pv,
      gaps: llm.perProductGaps[i] ?? pv.gaps,
      quickWins: llm.perProductWins[i] ?? pv.quickWins,
    })),
    simulation,
    liveSimulation: null,
    competitorSummary: llm.competitorSummary,
    catalogGaps: llm.catalogGaps,
    recommendations: llm.recommendations,
    rewrites: llm.rewrites.map((rw) => {
      const src = selected.find((p) => p.id === rw.productId);
      const img = src?.images[0];
      return {
        ...rw,
        imageUrl: img?.url ?? null,
        imageAlt: img?.alt ?? src?.title ?? null,
      };
    }),
    technicalAudit: llm.technicalAudit,
    measurementAppendix: llm.measurementAppendix,
  };

  try {
    opts.onProgress("llm", 86, "Checking which brands often come up for these questions…");
    const market = await fetchMarketBrandSignalsForPrompts(regionalPrompts);
    report.marketBrandSignals = regionalPrompts.map((prompt, i) => ({
      prompt,
      names: market.items[i]?.names ?? [],
    }));
    report.marketBrandDisclaimer = market.disclaimer;
  } catch {
    /* optional */
  }

  // Live-style ranking among your crawled products for each discovery prompt.
  try {
    if (regionalPrompts.length >= 3) {
      opts.onProgress("llm", 90, "Running live-style AI pick among your products…");
      const live = await runLiveAiSimulation({
        crawl,
        selected,
        prompts: regionalPrompts,
      });
      report.liveSimulation = live;
    }
  } catch {
    report.liveSimulation = null;
  }

  try {
    opts.onProgress("web_research", 91, "Running live web research on generated shopper queries…");
    report.realWorldPromptResearch = await runRealWorldPromptResearch({
      crawl,
      selected,
      category,
      region: regionTrim,
      luxury,
      onProgress: opts.onProgress,
    });
    try {
      opts.onProgress("web_synopsis", 98, "Summarizing live web findings for each report section…");
      report.realWorldWebResearchSynopsis = await summarizeWebResearchForPanels(
        report.realWorldPromptResearch,
      );
    } catch {
      /* optional */
    }
  } catch {
    /* optional — long-running / model access */
  }

  opts.onProgress("done", 100, "Your report is ready.");
  return report;
}
