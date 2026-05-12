import OpenAI from "openai";
import { getOpenAIModel } from "@/lib/config";
import type { AuditReportV1, CentralInsights } from "@/lib/types/report";
import { centralInsightsSchema } from "@/lib/types/report";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function primaryLabel(report: AuditReportV1): string {
  if (report.primaryStoreLabel?.trim()) return report.primaryStoreLabel.trim();
  try {
    return new URL(report.storeUrl).hostname.replace(/^www\./, "") || report.storeUrl;
  } catch {
    return report.storeUrl;
  }
}

function buildEvidenceJson(report: AuditReportV1): string {
  const store = primaryLabel(report);
  const rw = report.realWorldPromptResearch;
  const brandExcerpts =
    rw?.brandIntentResults.map((r) => ({
      query: r.prompt,
      excerpt: clip(r.analysis, 520),
    })) ?? [];
  const shoppingExcerpts =
    rw?.shoppingIntentResults.map((r) => ({
      query: r.prompt,
      excerpt: clip(r.analysis, 520),
    })) ?? [];

  const webDisc = report.webSearchDiscoveryRank?.results.map((r) => ({
    prompt: r.prompt,
    primaryMentioned: r.primaryMentioned,
    primaryApproxRank: r.primaryApproxRank,
    summary: clip(r.summary, 640),
    surfaced: r.surfacedExamples.slice(0, 6).map((e) => ({
      label: e.label,
      note: e.note ? clip(e.note, 160) : undefined,
    })),
  }));

  const live = report.liveSimulation?.results.map((r) => ({
    prompt: r.prompt,
    yourProductShown: r.yourProductShown,
    yourBestRank: r.yourBestRank,
    winnerStoreLabel: r.winnerStoreLabel,
    topPickLabels: r.picks.slice(0, 5).map((p) =>
      `${p.storeLabel}: ${p.productTitle}${p.url?.trim() ? ` — ${clip(p.url.trim(), 80)}` : ""}`,
    ),
  }));

  const payload = {
    storeLabel: store,
    storeUrl: report.storeUrl,
    region: report.regionHint,
    category: report.categoryHint,
    luxury: report.luxuryHint,
    overallScore: report.overallScore,
    overallBreakdown: report.overallBreakdown,
    brandAiSearchRank: {
      composite: report.brandAiSearchRank.composite,
      avgRank: report.brandAiSearchRank.avgRank ?? null,
      comparedStoreCount: report.brandAiSearchRank.comparedStoreCount ?? null,
      perQuery: report.brandAiSearchRank.perQuery.slice(0, 9).map((q) => ({
        query: q.query,
        brandScore: q.brandScore,
        rankAmong: q.rankAmong,
        leaderHint: q.leaderHint,
      })),
      strongestQueries: report.brandAiSearchRank.strongestQueries,
      weakestQueries: report.brandAiSearchRank.weakestQueries,
    },
    simulation: report.simulation.slice(0, 9).map((s) => ({
      prompt: s.prompt,
      rankings: s.rankings.map((r) => ({
        label: r.label,
        score: r.score,
        isPrimaryBrand: r.isPrimaryBrand,
      })),
    })),
    liveSimulationNote: report.liveSimulation?.note ?? null,
    liveSimulationRows: live ?? null,
    webSearchDiscovery: webDisc ?? null,
    liveWebResearch: rw
      ? {
          disclaimer: rw.disclaimer,
          brandIntentExcerpts: brandExcerpts,
          shoppingIntentExcerpts: shoppingExcerpts,
        }
      : null,
    marketBrandSignals: report.marketBrandSignals?.slice(0, 9) ?? null,
    marketBrandDisclaimer: report.marketBrandDisclaimer ?? null,
    competitorSummary: report.competitorSummary,
    catalogGaps: report.catalogGaps,
    recommendations: report.recommendations,
    products: report.products.map((p) => ({
      title: p.title,
      overall: p.overall,
      gaps: p.gaps,
      quickWins: p.quickWins,
      breakdown: p.breakdown,
      perPrompt: p.perPrompt.slice(0, 6).map((x) => ({
        prompt: x.prompt,
        similarity: x.similarity,
        preview: clip(x.topChunkPreview, 140),
      })),
    })),
    technicalAudit: {
      jsonLd: clip(report.technicalAudit.jsonLdSummary, 500),
      meta: clip(report.technicalAudit.metaSummary, 500),
      media: clip(report.technicalAudit.mediaSummary, 500),
      crawlNotes: report.technicalAudit.crawlNotes.slice(0, 8),
    },
    measurementAppendix: report.measurementAppendix.slice(0, 10),
    weightsNote: clip(report.weightsNote, 400),
    reportDisclaimer: clip(report.disclaimer, 400),
  };

  return JSON.stringify(payload);
}

export async function generateCentralInsights(report: AuditReportV1): Promise<CentralInsights> {
  const model = getOpenAIModel();
  const evidence = buildEvidenceJson(report);
  const store = primaryLabel(report);

  const user = `You are agentShop. You have already run a full audit; the JSON below is the ONLY evidence you may use. Do not invent products, reviews, rankings, or URLs not supported by this JSON.

Evidence JSON:
${evidence}

Write ONE coherent merchant-facing report in plain text (no markdown, no bullet characters like * or -). Use paragraph breaks inside each string as the two-character sequence \\n\\n between paragraphs so the UI can render spacing.

Return a single JSON object with exactly these keys (each value is a long string):

1) executiveSummary — 3–5 tight paragraphs (total ~350–600 words): what this audit concluded for ${store} in plain language, how confident we can be given the mix of listing signals, crawl-limited AI picks, optional live web excerpts, and scores. Set expectations: this is guidance, not a guarantee of live assistant behavior.

2) aiAssistantRecommendation — detailed answer (aim ~450–900 words) to: "Are these products likely to be recommended by AI assistants?" Tie together brand match scores, per-product retrieval-style scores, structured live web picks (hostnames/URLs from web_search), and open-web discovery rows if present. Name strengths and weaknesses explicitly. If evidence is thin, say so.

3) competitorWinners — detailed answer (aim ~450–900 words) to: "Which competitors or alternatives may win instead?" Use simulation rankings, marketBrandSignals, competitorSummary, web shopping/brand excerpts, and webSearchDiscovery surfaced examples. Distinguish crawled competitors from generic brands the web surfaced. Do not claim you verified a specific competitor site unless the JSON names it.

4) aiReadinessGaps — detailed answer (aim ~450–900 words) to: "What product or catalog data gaps make this brand less AI-ready?" Synthesize catalogGaps, per-product gaps, technicalAudit fields, measurementAppendix themes, and any web research expectations. Be specific to the evidence.

5) agentShopActions — detailed answer (aim ~450–900 words) to: "What should agentShop recommend to improve AI visibility?" Prioritize actions; reference and extend the numbered recommendations already in the JSON where helpful, but you may reorder or merge them for clarity. Include sequencing (what to do first, next, later). Mention listing copy, structured product data, trust signals, differentiation, and monitoring—only where grounded in the audit.

Tone: direct, honest, non-hype. Same voice across all fields.`;

  const res = await getClient().chat.completions.create({
    model,
    temperature: 0.35,
    max_tokens: 12000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are agentShop's senior commerce strategist. Output valid JSON only. Never claim verified live rankings inside ChatGPT, Google, or other assistants. Ground every substantive claim in the provided evidence JSON.",
      },
      { role: "user", content: user },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty central insights response");
  const json = JSON.parse(raw) as unknown;
  const pr = centralInsightsSchema.safeParse(json);
  if (!pr.success) throw new Error(pr.error.message);
  return pr.data;
}
