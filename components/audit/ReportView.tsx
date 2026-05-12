"use client";

import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import type { AuditReportV1, RealWorldPromptResearch } from "@/lib/types/report";
import { BreakdownChart } from "@/components/charts/BreakdownChart";
import { SimulationBarChart } from "@/components/charts/SimulationBarChart";
import { ReportPdfDocument } from "@/components/pdf/ReportPdfDocument";
import { StorefrontImage } from "@/components/StorefrontImage";
function ProductThumb({
  imageUrl,
  imageAlt,
  title,
}: {
  imageUrl?: string | null;
  imageAlt?: string | null;
  title: string;
}) {
  const url = imageUrl?.trim() || null;
  return (
    <Box
      sx={{
        width: 72,
        height: 72,
        flexShrink: 0,
        borderRadius: 1.5,
        overflow: "hidden",
        bgcolor: "action.hover",
        position: "relative",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {url ? (
        <StorefrontImage src={url} alt={imageAlt ?? title} sizes="72px" />
      ) : (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            typography: "caption",
            color: "text.secondary",
            px: 0.5,
            textAlign: "center",
          }}
        >
          No image
        </Box>
      )}
    </Box>
  );
}

function primaryHostnameLabel(storeUrl: string): string {
  try {
    return new URL(storeUrl).hostname.replace(/^www\./, "") || storeUrl;
  } catch {
    return storeUrl;
  }
}

function CentralNarrative({ text }: { text: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        mb: 2,
        borderColor: "divider",
        bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "grey.50"),
      }}
    >
      <Typography variant="body1" sx={{ whiteSpace: "pre-line", lineHeight: 1.75 }}>
        {text}
      </Typography>
    </Paper>
  );
}

function WebResearchPanelHint({ text }: { text?: string | null }) {
  const t = text?.trim();
  if (!t) return null;
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        borderColor: "divider",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "grey.50",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 700, letterSpacing: 0.04, display: "block", mb: 1 }}
      >
        Live web snapshot
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t}
      </Typography>
    </Paper>
  );
}

function collectResearchUrls(r: RealWorldPromptResearch): string[] {
  const u = new Set<string>();
  outer: for (const x of [...r.brandIntentResults, ...r.shoppingIntentResults]) {
    for (const s of x.sources) {
      if (s.url) u.add(s.url);
      if (u.size >= 24) break outer;
    }
  }
  return [...u];
}

function WebResearchQueriesExplorer({ research }: { research: RealWorldPromptResearch }) {
  const urls = collectResearchUrls(research);
  const prompts = [...research.brandIntentPrompts, ...research.shoppingIntentPrompts];
  return (
    <Accordion
      variant="outlined"
      disableGutters
      sx={{ borderRadius: 2, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon aria-hidden />}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Shopper queries we searched on the live web
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          {research.disclaimer}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
          Queries (5 brand-style, 5 where-to-buy style)
        </Typography>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", mb: urls.length ? 2 : 0 }}>
          {prompts.map((q, qi) => (
            <Chip
              key={`${qi}-${q.slice(0, 40)}`}
              size="small"
              label={q.length > 72 ? `${q.slice(0, 70)}…` : q}
              variant="outlined"
            />
          ))}
        </Stack>
        {urls.length ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
              Top sources seen across searches
            </Typography>
            <Stack spacing={0.25}>
              {urls.slice(0, 12).map((href) => (
                <Link
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  sx={{ fontSize: 13 }}
                >
                  {href}
                </Link>
              ))}
            </Stack>
          </>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}

export function ReportView({ report }: { report: AuditReportV1 }) {
  const [tab, setTab] = useState(0);
  const storeLabel = report.primaryStoreLabel ?? primaryHostnameLabel(report.storeUrl);
  const rankLabels = report.simulation[0]?.rankings.map((r) => r.label) ?? [];
  const simData = report.simulation.map((s) => {
    const row: Record<string, string | number> = {
      prompt: s.prompt.slice(0, 48) + (s.prompt.length > 48 ? "…" : ""),
    };
    for (const label of rankLabels) {
      row[label] = s.rankings.find((r) => r.label === label)?.score ?? 0;
    }
    return row;
  });

  const handlePdf = async () => {
    const blob = await pdf(<ReportPdfDocument report={report} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-shelf-audit-${report.generatedAt.slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack
      spacing={3}
      sx={{
        // Readability pass: avoid tiny text in the report
        "& .MuiTypography-body2": { fontSize: 14, lineHeight: 1.55 },
        "& .MuiTypography-caption": { fontSize: 12, lineHeight: 1.45 },
        "& .MuiTab-root": { fontSize: 14 },
      }}
    >
      <Paper sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">
              Overall shelf score
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700 }}>
              {report.overallScore}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {report.disclaimer}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => void handlePdf()}
              sx={{
                borderRadius: 999,
                px: 2.5,
                py: 1.1,
                minHeight: 44,
                alignSelf: { xs: "stretch", sm: "flex-start" },
                "& .MuiButton-startIcon": { marginRight: 1 },
              }}
            >
              Export PDF
            </Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          What’s driving your score
        </Typography>
        <BreakdownChart breakdown={report.overallBreakdown} />
      </Paper>

      <Paper sx={{ p: 2.5, borderColor: "primary.dark", borderWidth: 1, borderStyle: "solid" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          What this report answers
        </Typography>
        {report.centralInsights ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              One agentShop narrative across four tabs: (1) whether AI assistants are likely to recommend you, (2)
              who may win the shopper instead, (3) catalog and listing gaps that hurt AI-readiness, and (4) what to do
              next for visibility. The same tabs still hold your scores, charts, and raw research for evidence.
            </Typography>
            <CentralNarrative text={report.centralInsights.executiveSummary} />
          </>
        ) : (
          <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Assistant fit</strong> — {storeLabel}: how public listings line up with sample shopper questions and
              per-product scores, plus open-web discovery and crawl-limited picks where available.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Competition</strong> — Other crawled stores, charts, and market-name context for the same
              questions.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Data gaps</strong> — Catalog and listing completeness (structured data, trust signals, clarity).
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              <strong>Next steps</strong> — Prioritized fixes and rewrites grounded in this audit.
            </Typography>
          </Stack>
        )}
        {!report.centralInsights && report.realWorldWebResearchSynopsis?.overview ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            {report.realWorldWebResearchSynopsis.overview}
          </Typography>
        ) : null}
      </Paper>

      {report.realWorldPromptResearch ? (
        <Paper sx={{ p: 2, borderColor: "divider", borderWidth: 1, borderStyle: "solid" }}>
          <WebResearchQueriesExplorer research={report.realWorldPromptResearch} />
        </Paper>
      ) : null}

      <Paper sx={{ overflow: "visible" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            px: { xs: 1, sm: 2 },
            "& .MuiTab-root": { minHeight: 48, textTransform: "none", fontWeight: 600 },
          }}
        >
          <Tab label="Assistant fit" id="report-tab-0" aria-controls="report-panel-0" />
          <Tab label="Competition" id="report-tab-1" aria-controls="report-panel-1" />
          <Tab label="Data gaps" id="report-tab-2" aria-controls="report-panel-2" />
          <Tab label="Next steps" id="report-tab-3" aria-controls="report-panel-3" />
        </Tabs>

        <Box role="tabpanel" id="report-panel-0" aria-labelledby="report-tab-0" hidden={tab !== 0} sx={{ p: 3 }}>
          {tab === 0 ? (
            <Stack spacing={3}>
              {report.centralInsights ? (
                <CentralNarrative text={report.centralInsights.aiAssistantRecommendation} />
              ) : (
                <WebResearchPanelHint
                  text={
                    report.realWorldWebResearchSynopsis?.assistantFitPanel ??
                    (report.realWorldPromptResearch
                      ? "Live web research ran on ten generated shopper queries; open “Shopper queries we searched” above for the exact wording. When summarization succeeds, a short snapshot appears in each tab."
                      : null)
                  }
                />
              )}
              {report.centralInsights ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1, mb: 0.5 }}>
                  Supporting detail for {storeLabel}: scores, crawl-limited picks, open-web checks, and per-product
                  cards below.
                </Typography>
              ) : null}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Likely AI assistant pickup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                  {report.centralInsights
                    ? "How strongly your public product wording aligns with the same regional discovery prompts used elsewhere in this report."
                    : `We match sample shopper questions to public product wording for ${storeLabel}. Higher scores mean those listings better align with those questions—a useful signal, not a guarantee of live rankings.`}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Combined match: <strong>{report.brandAiSearchRank.composite}</strong>
                </Typography>
                {typeof report.brandAiSearchRank.avgRank === "number" &&
                typeof report.brandAiSearchRank.comparedStoreCount === "number" ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Average rank: <strong>#{report.brandAiSearchRank.avgRank}</strong> out of{" "}
                    <strong>{report.brandAiSearchRank.comparedStoreCount}</strong> stores (lower is better)
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>
                  {report.brandAiSearchRank.strongestQueries.slice(0, 3).map((q) => (
                    <Chip key={q} size="small" label={`Strong: ${q.slice(0, 36)}…`} variant="outlined" />
                  ))}
                </Stack>
                <Stack spacing={1.5}>
                  {report.brandAiSearchRank.perQuery.slice(0, 8).map((q) => (
                    <Box key={q.query}>
                      <Typography variant="subtitle2">{q.query}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Match {q.brandScore}
                        {q.rankAmong ? ` · vs others in this run: #${q.rankAmong}` : ""}
                        {q.leaderHint ? ` · ${q.leaderHint}` : ""}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Divider />

              {report.liveSimulation?.results?.length ? (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Live web picks
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                    {report.liveSimulation.note}
                  </Typography>
                  <Stack spacing={2}>
                    {report.liveSimulation.results.map((r) => (
                      <Paper key={r.prompt} variant="outlined" sx={{ p: 2, borderColor: "divider" }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {r.prompt}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {r.yourProductShown ? (
                              <>
                                <strong>{storeLabel}</strong> showed up (best rank{" "}
                                <strong>{r.yourBestRank ? `#${r.yourBestRank}` : "—"}</strong>).
                              </>
                            ) : (
                              <>
                                <strong>{storeLabel}</strong> did not show up in the top picks for this prompt.
                              </>
                            )}{" "}
                            {r.winnerStoreLabel ? (
                              <>
                                Winner: <strong>{r.winnerStoreLabel}</strong>
                              </>
                            ) : null}
                          </Typography>
                          <Stack spacing={1} sx={{ mt: 1 }}>
                            {r.picks.slice(0, 5).map((p) => (
                              <Stack key={`${p.rank}-${p.storeLabel}-${p.productTitle}`} direction="row" spacing={1.5}>
                                <ProductThumb imageUrl={p.imageUrl} imageAlt={p.imageAlt} title={p.productTitle} />
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography sx={{ fontWeight: 600 }}>
                                    #{p.rank} · {p.storeLabel}
                                  </Typography>
                                  <Typography variant="body2">{p.productTitle}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {p.reason}
                                  </Typography>
                                  {p.url?.trim() ? (
                                    <Link
                                      href={p.url.trim()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="body2"
                                      sx={{ display: "inline-block", mt: 0.5 }}
                                    >
                                      Open page
                                    </Link>
                                  ) : null}
                                </Box>
                              </Stack>
                            ))}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {report.webSearchDiscoveryRank?.results?.length ? (
                <>
                  <Divider />
                  <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Open web discovery (live search)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                    {report.webSearchDiscoveryRank.disclaimer}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                    {report.webSearchDiscoveryRank.note}
                  </Typography>
                  <Stack spacing={2}>
                    {report.webSearchDiscoveryRank.results.map((r) => (
                      <Paper key={r.prompt} variant="outlined" sx={{ p: 2, borderColor: "divider" }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {r.prompt}
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                            <Chip
                              size="small"
                              label={
                                r.primaryMentioned
                                  ? `${storeLabel} mentioned (approx #${r.primaryApproxRank ?? "?"})`
                                  : `${storeLabel} not in notable organic-style results`
                              }
                              color={r.primaryMentioned ? "success" : "default"}
                              variant={r.primaryMentioned ? "filled" : "outlined"}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {r.summary}
                          </Typography>
                          {r.surfacedExamples.length ? (
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                What else showed up (examples)
                              </Typography>
                              <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2, mt: 0.5 }}>
                                {r.surfacedExamples.map((ex, i) => (
                                  <Typography key={`${ex.label}-${i}`} component="li" variant="body2">
                                    <strong>{ex.label}</strong>
                                    {ex.note ? ` — ${ex.note}` : ""}
                                    {ex.url?.trim() ? (
                                      <>
                                        {" "}
                                        <Link href={ex.url.trim()} target="_blank" rel="noopener noreferrer">
                                          Link
                                        </Link>
                                      </>
                                    ) : null}
                                  </Typography>
                                ))}
                              </Stack>
                            </Box>
                          ) : null}
                          <Typography variant="caption" color="text.secondary">
                            {r.caveats}
                          </Typography>
                          {r.sourceUrls.length ? (
                            <Stack spacing={0.25}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Search tool sources (URLs)
                              </Typography>
                              <Stack spacing={0.25} sx={{ pl: 0 }}>
                                {r.sourceUrls.slice(0, 8).map((u) => (
                                  <Link
                                    key={u}
                                    href={u}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="caption"
                                    sx={{ wordBreak: "break-all" }}
                                  >
                                    {u}
                                  </Link>
                                ))}
                              </Stack>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
                </>
              ) : null}

              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {storeLabel} — products in this run
                </Typography>
                <Stack spacing={1}>
                  {report.products.map((p) => (
                    <Accordion key={p.productId} defaultExpanded disableGutters>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={2} sx={{ width: "100%", alignItems: "center", py: 0.5 }}>
                          <ProductThumb imageUrl={p.imageUrl} imageAlt={p.imageAlt} title={p.title} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 600 }}>{p.title}</Typography>
                          </Box>
                          <Chip label={p.overall} size="small" color="primary" variant="outlined" sx={{ flexShrink: 0 }} />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={2}>
                          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <BreakdownChart breakdown={p.breakdown} compact />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                What’s missing or weak
                              </Typography>
                              {p.gaps.map((g) => (
                                <Typography key={g} variant="body2" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                                  • {g}
                                </Typography>
                              ))}
                              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                Quick improvements
                              </Typography>
                              {p.quickWins.map((g) => (
                                <Typography key={g} variant="body2" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                                  • {g}
                                </Typography>
                              ))}
                            </Box>
                          </Stack>
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                              Sample questions vs this product
                            </Typography>
                            {p.perPrompt.map((pp) => (
                              <Typography key={pp.prompt} variant="body2" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                                <strong>{pp.similarity}</strong> match — {pp.prompt}
                                <br />
                                <Box component="span" sx={{ opacity: 0.75, fontSize: 12 }}>
                                  {pp.topChunkPreview}
                                </Box>
                              </Typography>
                            ))}
                          </Box>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </Box>

        <Box role="tabpanel" id="report-panel-1" aria-labelledby="report-tab-1" hidden={tab !== 1} sx={{ p: 3 }}>
          {tab === 1 ? (
            <Stack spacing={3}>
              {report.centralInsights ? (
                <CentralNarrative text={report.centralInsights.competitorWinners} />
              ) : (
                <WebResearchPanelHint
                  text={
                    report.realWorldWebResearchSynopsis?.competitionPanel ??
                    (report.realWorldPromptResearch
                      ? "This tab compares your crawl to other stores and prompts. Live web research adds what shoppers might see when they search for brands or places to buy—see the query list above."
                      : null)
                  }
                />
              )}
              {report.centralInsights ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1, mb: 0.5 }}>
                  Supporting detail: named alternatives, charted wording vs prompts, and regional readout below.
                </Typography>
              ) : null}
              {report.marketBrandSignals?.length ? (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Who shoppers might hear about
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                    For each regional discovery prompt, the model suggests well-known brands or makers shoppers might
                    see named alongside your category—so you can sense the competitive “noise” without pasting
                    competitor URLs.
                  </Typography>
                  {report.marketBrandDisclaimer ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                      {report.marketBrandDisclaimer}
                    </Typography>
                  ) : null}
                  <Stack spacing={2}>
                    {report.marketBrandSignals.map((row) => (
                      <Paper key={row.prompt} variant="outlined" sx={{ p: 2, borderColor: "divider" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          {row.prompt}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                          {row.names.map((n) => (
                            <Chip key={n} size="small" label={n} variant="outlined" />
                          ))}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Catalog wording vs discovery prompts
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                  {rankLabels.length > 1
                    ? "Bars score how closely your public wording matches each discovery prompt, compared to any extra stores we crawled."
                    : "Bars score how closely your selected products’ public wording matches each discovery prompt (no extra stores in this run)."}
                </Typography>
                <Box sx={{ width: "100%", height: 340, position: "relative" }}>
                  <SimulationBarChart simData={simData} rankLabels={rankLabels} />
                </Box>
              </Box>

              {report.competitorSummary ? (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Regional market readout
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {report.competitorSummary}
                  </Typography>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </Box>

        <Box role="tabpanel" id="report-panel-2" aria-labelledby="report-tab-2" hidden={tab !== 2} sx={{ p: 3 }}>
          {tab === 2 ? (
            <Stack spacing={3}>
              {report.centralInsights ? (
                <CentralNarrative text={report.centralInsights.aiReadinessGaps} />
              ) : (
                <WebResearchPanelHint
                  text={
                    report.realWorldWebResearchSynopsis?.dataGapsPanel ??
                    (report.realWorldPromptResearch
                      ? "This tab is about listing completeness and trust signals on your own pages. Web research hints at what the broader market often expects to see for similar searches."
                      : null)
                  }
                />
              )}
              {report.centralInsights ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1, mb: 0.5 }}>
                  Supporting detail: checklist gaps, technical notes, and measurement appendix below.
                </Typography>
              ) : null}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Store-wide content gaps
                </Typography>
                {report.catalogGaps.map((c) => (
                  <Typography key={c} variant="body2" sx={{ mb: 1, display: "block" }}>
                    • {c}
                  </Typography>
                ))}
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Behind-the-scenes setup
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, display: "block" }}>
                  {report.technicalAudit.jsonLdSummary}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, display: "block" }}>
                  {report.technicalAudit.metaSummary}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, display: "block" }}>
                  {report.technicalAudit.mediaSummary}
                </Typography>
                {report.technicalAudit.crawlNotes.length ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Scan notes: {report.technicalAudit.crawlNotes.join("; ")}
                  </Typography>
                ) : null}
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  How this was measured
                </Typography>
                {report.measurementAppendix.map((m) => (
                  <Typography key={m} variant="body2" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                    • {m}
                  </Typography>
                ))}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                  {report.weightsNote}
                </Typography>
              </Box>
            </Stack>
          ) : null}
        </Box>

        <Box role="tabpanel" id="report-panel-3" aria-labelledby="report-tab-3" hidden={tab !== 3} sx={{ p: 3 }}>
          {tab === 3 ? (
            <Stack spacing={3}>
              {report.centralInsights ? (
                <CentralNarrative text={report.centralInsights.agentShopActions} />
              ) : (
                <WebResearchPanelHint
                  text={
                    report.realWorldWebResearchSynopsis?.nextStepsPanel ??
                    (report.realWorldPromptResearch
                      ? "These actions come from your listing audit. When web research ran, it informs tone and completeness priorities—not a second crawl."
                      : null)
                  }
                />
              )}
              {report.centralInsights ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1, mb: 0.5 }}>
                  Supporting detail: prioritized checklist and suggested rewrites per product below.
                </Typography>
              ) : null}
              <Box>
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  agentShop recommendations
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                  Prioritized actions to make your listings easier for AI assistants and smart shopping surfaces to
                  understand and recommend.
                </Typography>
                {report.recommendations.map((c, i) => (
                  <Typography key={i} variant="body2" sx={{ mb: 1, display: "block" }}>
                    {i + 1}. {c}
                  </Typography>
                ))}
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Suggested titles &amp; bullets
                </Typography>
                {report.rewrites.map((rw) => (
                  <Stack
                    key={rw.productId}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{ mb: 3, alignItems: { sm: "flex-start" } }}
                  >
                    <ProductThumb imageUrl={rw.imageUrl} imageAlt={rw.imageAlt} title={rw.title} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>{rw.title}</Typography>
                      <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                        {rw.suggestedTitle}
                      </Typography>
                      <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        {rw.bullets.map((b) => (
                          <li key={b}>
                            <Typography variant="body2">{b}</Typography>
                          </li>
                        ))}
                      </ul>
                      <Typography variant="body2" sx={{ mb: 1, display: "block" }}>
                        {rw.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        FAQ ideas: {rw.faqIdeas.join(" · ")}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            </Stack>
          ) : null}
        </Box>
      </Paper>
    </Stack>
  );
}
