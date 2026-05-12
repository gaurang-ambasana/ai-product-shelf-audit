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
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import type { AuditReportV1 } from "@/lib/types/report";
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

export function ReportView({ report }: { report: AuditReportV1 }) {
  const [tab, setTab] = useState(0);
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
        <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            <strong>Assistant fit</strong> — Are your products likely to be picked up and recommended by AI shopping
            helpers, based on your public pages?
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            <strong>Competition</strong> — Which other stores in this scan may rank ahead for the same kinds of
            questions?
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            <strong>Data gaps</strong> — What’s missing in your product or catalog content that makes you less
            “AI-ready”?
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            <strong>Next steps</strong> — What agentShop recommends you do next to improve AI visibility.
          </Typography>
        </Stack>
      </Paper>

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
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Likely AI assistant pickup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                  We match sample shopper questions to your public product wording. Higher scores mean your listings
                  better align with those questions—useful signal for whether an assistant might surface you—not a
                  guarantee of live rankings.
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
                    Live-style AI test (beta)
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
                                Your store showed up (best rank{" "}
                                <strong>{r.yourBestRank ? `#${r.yourBestRank}` : "—"}</strong>).
                              </>
                            ) : (
                              <>Your store didn’t show up in the top picks for this prompt.</>
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

              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Your products in this run
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
                  Your catalog vs each prompt (offline match)
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
