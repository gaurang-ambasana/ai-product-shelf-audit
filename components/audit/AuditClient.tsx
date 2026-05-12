"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LinkIcon from "@mui/icons-material/Link";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Container from "@mui/material/Container";
import FormControlLabel from "@mui/material/FormControlLabel";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrawlResult } from "@/lib/types/crawl";
import type { AuditReportV1 } from "@/lib/types/report";
import { consumeNdjsonStream } from "@/lib/stream/read-ndjson";
import {
  logClientError,
  toUserMessage,
  type AppErrorCode,
} from "@/lib/errors";
import { MAX_SELECTED_PRODUCTS } from "@/lib/config";
import { progressPhaseLabel } from "@/lib/copy/ui-strings";
import { decodeReportFromUrl, encodeReportForUrl } from "@/lib/share/report-codec";
import { useErrorSnackbar } from "@/components/providers/ErrorSnackbarProvider";
import { LoadingRunScreen } from "./LoadingRunScreen";
import { ProductPickerGrid } from "./ProductPickerGrid";
import { ReportView } from "./ReportView";

type CrawlNdjson =
  | {
      type: "progress";
      phase: string;
      percent: number;
      message: string;
      storeIndex?: number;
      storeTotal?: number;
    }
  | { type: "error"; code: AppErrorCode }
  | { type: "result"; data: CrawlResult };

type AnalyzeNdjson =
  | { type: "progress"; phase: string; percent: number; message: string }
  | { type: "error"; code: AppErrorCode }
  | { type: "result"; data: AuditReportV1 };

function usePickPageSize(): number {
  const theme = useTheme();
  const downSm = useMediaQuery(theme.breakpoints.down("sm"));
  const downMd = useMediaQuery(theme.breakpoints.down("md"));
  const downLg = useMediaQuery(theme.breakpoints.down("lg"));
  return useMemo(() => {
    if (downSm) return 4;
    if (downMd) return 6;
    if (downLg) return 9;
    return 12;
  }, [downSm, downMd, downLg]);
}

export function AuditClient() {
  const { showError } = useErrorSnackbar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickPageSize = usePickPageSize();

  const [step, setStep] = useState<"form" | "pick" | "report">("form");
  const [storeUrl, setStoreUrl] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [luxury, setLuxury] = useState(false);

  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<"crawl" | "analyze">("crawl");
  const [phase, setPhase] = useState("");
  const [message, setMessage] = useState("");
  const [percent, setPercent] = useState(0);

  const [crawl, setCrawl] = useState<CrawlResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickPage, setPickPage] = useState(0);
  const [report, setReport] = useState<AuditReportV1 | null>(null);
  const catalogScrollRef = useRef<HTMLDivElement>(null);

  const hydrateFromUrl = useCallback(() => {
    const r = searchParams.get("r");
    if (!r) return;
    const decoded = decodeReportFromUrl(r);
    if (decoded) {
      setReport(decoded);
      setStep("report");
    } else {
      logClientError({ message: "Failed to decode shared report from URL" });
      showError(toUserMessage("BAD_REQUEST"));
    }
  }, [searchParams, showError]);

  useEffect(() => {
    startTransition(() => {
      hydrateFromUrl();
    });
  }, [hydrateFromUrl]);

  const productList = crawl?.primary.products;
  const productCount = productList?.length ?? 0;
  const pickTotalPages = Math.max(1, Math.ceil(productCount / pickPageSize));
  const maxPickPageIndex = Math.max(0, pickTotalPages - 1);
  const effectivePickPage = Math.min(pickPage, maxPickPageIndex);
  const pickRangeStart = effectivePickPage * pickPageSize;
  const pickPageProducts = useMemo(() => {
    if (!productList?.length) return [];
    return productList.slice(pickRangeStart, pickRangeStart + pickPageSize);
  }, [productList, pickRangeStart, pickPageSize]);

  useEffect(() => {
    if (step !== "pick") return;
    catalogScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [effectivePickPage, step]);

  const runCrawl = async () => {
    setBusy(true);
    setBusyMode("crawl");
    setPercent(0);
    setPhase("store");
    setMessage("Getting started…");
    try {
      let streamErrored = false;
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeUrl,
          competitorUrls: [],
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { code?: AppErrorCode } | null;
        const code = j?.code ?? "CRAWL_FAILED";
        logClientError({ code, message: "Crawl HTTP error", extra: { status: res.status } });
        showError(toUserMessage(code));
        return;
      }
      await consumeNdjsonStream<CrawlNdjson>(res, (row) => {
        if (row.type === "progress") {
          setPercent(row.percent);
          setPhase(row.phase);
          setMessage(row.message);
        } else if (row.type === "error") {
          streamErrored = true;
          logClientError({ code: row.code, message: "Crawl stream error" });
          showError(toUserMessage(row.code));
        } else if (row.type === "result" && !streamErrored) {
          if (!row.data.primary.products.length) {
            showError(toUserMessage("CRAWL_FAILED"));
            return;
          }
          setCrawl(row.data);
          setSelected(new Set());
          setPickPage(0);
          setStep("pick");
        }
      });
    } catch (e) {
      logClientError({ message: "Crawl client failure", cause: e });
      showError(toUserMessage("STREAM_ERROR"));
    } finally {
      setBusy(false);
    }
  };

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECTED_PRODUCTS) next.add(id);
      return next;
    });
  };

  const runAnalyze = async () => {
    if (!crawl || selected.size === 0) return;
    if (!region.trim()) {
      showError("Please go back and enter a customer region—reports need it for regional prompts.");
      return;
    }
    setBusy(true);
    setBusyMode("analyze");
    setPercent(0);
    setPhase("chunk");
    setMessage("Getting started…");
    try {
      let streamErrored = false;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crawl,
          selectedProductIds: [...selected],
          category: category || undefined,
          region: region.trim(),
          luxury,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { code?: AppErrorCode } | null;
        const code = j?.code ?? "ANALYSIS_FAILED";
        logClientError({ code, message: "Analyze HTTP error", extra: { status: res.status } });
        showError(toUserMessage(code));
        return;
      }
      await consumeNdjsonStream<AnalyzeNdjson>(res, (row) => {
        if (row.type === "progress") {
          setPercent(row.percent);
          setPhase(row.phase);
          setMessage(row.message);
        } else if (row.type === "error") {
          streamErrored = true;
          logClientError({ code: row.code, message: "Analyze stream error" });
          showError(toUserMessage(row.code));
        } else if (row.type === "result" && !streamErrored) {
          setReport(row.data);
          setStep("report");
          const { payload, tooLarge } = encodeReportForUrl(row.data);
          if (!tooLarge) {
            const url = new URL(window.location.href);
            url.searchParams.set("r", payload);
            router.replace(`${url.pathname}?${url.searchParams.toString()}`, {
              scroll: false,
            });
          }
        }
      });
    } catch (e) {
      logClientError({ message: "Analyze client failure", cause: e });
      showError(toUserMessage("STREAM_ERROR"));
    } finally {
      setBusy(false);
    }
  };

  const copyShareLink = async () => {
    if (!report) return;
    const { payload, tooLarge } = encodeReportForUrl(report);
    if (tooLarge) {
      showError(
        "This report is too large to copy as a link. Use Export PDF on the report instead.",
      );
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("r", payload);
    await navigator.clipboard.writeText(url.toString());
  };

  const reset = () => {
    setStep("form");
    setCrawl(null);
    setReport(null);
    setSelected(new Set());
    setPickPage(0);
    router.replace("/audit", { scroll: false });
  };

  const isPickCatalogStep = step === "pick" && crawl && !busy;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: isPickCatalogStep ? "100dvh" : undefined,
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          py: 4,
          ...(isPickCatalogStep
            ? {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }
            : {}),
        }}
      >
        <Stack
          spacing={3}
          sx={{
            ...(isPickCatalogStep
              ? {
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }
              : {}),
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Product shelf check
            </Typography>
            {step !== "form" ? (
              <Button startIcon={<ArrowBackIcon />} onClick={reset} variant="outlined">
                Start over
              </Button>
            ) : null}
          </Stack>

        {step === "form" && !busy ? (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography color="text.secondary">
                Paste your shop’s public website address. We only read pages anyone can see online—no logins or
                admin access. Choose a <strong>region</strong> so discovery prompts match where your customers shop.
              </Typography>
              <TextField
                label="Your store’s website"
                placeholder="https://yourbrand.com"
                fullWidth
                required
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
              />
              <TextField
                label="What you sell (optional)"
                placeholder="e.g. running shoes, skincare, home decor"
                fullWidth
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <TextField
                label="Customer region (required)"
                placeholder="e.g. United States, France, India, California"
                fullWidth
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                helperText="We use this to build regional “top brands / makers in …” style prompts—no competitor URLs needed."
              />
              <FormControlLabel
                control={<Checkbox checked={luxury} onChange={(e) => setLuxury(e.target.checked)} />}
                label="Premium or luxury brand"
              />
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                disabled={!storeUrl.trim() || !region.trim()}
                onClick={() => void runCrawl()}
              >
                Scan my store
              </Button>
            </Stack>
          </Paper>
        ) : null}

        {step === "pick" && crawl && !busy ? (
          <Paper
            sx={{
              p: { xs: 2, sm: 3 },
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Stack spacing={2} sx={{ flexShrink: 0 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                  alignItems: { xs: "stretch", md: "flex-start" },
                  justifyContent: "space-between",
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0, maxWidth: { md: "min(100%, 560px)" } }}>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                    Pick up to {MAX_SELECTED_PRODUCTS} products
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    We score how clear and complete those listings are, and how well they answer typical shopper
                    questions.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Browse the full catalog with the pager below—your selections stay saved when you change pages.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                    {selected.size} of {MAX_SELECTED_PRODUCTS} selected · click a card to add or remove it
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  disabled={selected.size === 0}
                  onClick={() => void runAnalyze()}
                  sx={{
                    flexShrink: 0,
                    alignSelf: { xs: "stretch", md: "flex-start" },
                    minWidth: { md: 200 },
                  }}
                >
                  Build my report
                </Button>
              </Stack>
            </Stack>

            <Box
              ref={catalogScrollRef}
              sx={{
                flex: 1,
                minHeight: 0,
                my: 2,
                mx: -0.5,
                px: 0.5,
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <ProductPickerGrid
                products={pickPageProducts}
                selected={selected}
                maxSelected={MAX_SELECTED_PRODUCTS}
                onToggle={toggleProduct}
              />
            </Box>

            <Stack spacing={1.5} sx={{ flexShrink: 0, alignItems: "center", pt: 0.5 }}>
              {pickTotalPages > 1 ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                    Showing{" "}
                    {productCount === 0
                      ? "0"
                      : `${pickRangeStart + 1}–${Math.min(pickRangeStart + pickPageSize, productCount)}`}{" "}
                    of {productCount} products · page {effectivePickPage + 1} of {pickTotalPages}
                  </Typography>
                  <Pagination
                    count={pickTotalPages}
                    page={effectivePickPage + 1}
                    onChange={(_, value) => setPickPage(value - 1)}
                    color="primary"
                    size="large"
                    showFirstButton
                    showLastButton
                    siblingCount={0}
                    boundaryCount={1}
                  />
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                  {productCount} product{productCount === 1 ? "" : "s"} in this scan
                </Typography>
              )}
            </Stack>
          </Paper>
        ) : null}

        {step === "report" && report ? (
          <Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>
              <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => void copyShareLink()}>
                Copy link to this report
              </Button>
            </Stack>
            <ReportView report={report} />
          </Box>
        ) : null}

        {busy ? (
          <Paper sx={{ p: 2 }}>
            <LoadingRunScreen
              title={busyMode === "crawl" ? "Scanning your store" : "Building your report"}
              phaseLabel={progressPhaseLabel(phase)}
              message={message}
              percent={percent}
            />
          </Paper>
        ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
