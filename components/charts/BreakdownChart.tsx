"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import "@/lib/chart/register";
import { SCORE_DIMENSION_LABELS } from "@/lib/copy/ui-strings";
import type { ScoreBreakdown } from "@/lib/types/report";
import { chartGridColor, chartTickColor, darkTooltipPlugin } from "@/lib/chart/theme";

const KEYS: (keyof ScoreBreakdown)[] = [
  "semanticClarity",
  "metadataCompleteness",
  "structuredData",
  "retrievalFriendliness",
  "comparisonReadiness",
  "trustSignals",
  "contentUniqueness",
];

export function BreakdownChart({
  breakdown,
  compact,
}: {
  breakdown: ScoreBreakdown;
  compact?: boolean;
}) {
  const { data, options } = useMemo(() => {
    const labels = KEYS.map((k) => SCORE_DIMENSION_LABELS[k]);
    const scores = KEYS.map((k) => breakdown[k]);

    const options: ChartOptions<"bar"> = {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: darkTooltipPlugin,
        legend: { display: false },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { color: chartTickColor, font: { size: 11 } },
          grid: { color: chartGridColor },
          border: { color: chartGridColor },
        },
        y: {
          ticks: {
            color: chartTickColor,
            font: { size: compact ? 10 : 11 },
            autoSkip: false,
          },
          grid: { display: false },
          border: { display: false },
        },
      },
    };

    const data = {
      labels,
      datasets: [
        {
          label: "Score",
          data: scores,
          backgroundColor: "#7c6cf5",
          borderRadius: { topRight: 6, bottomRight: 6, topLeft: 0, bottomLeft: 0 },
          borderSkipped: false as const,
        },
      ],
    };

    return { data, options };
  }, [breakdown, compact]);

  return (
    <div style={{ width: "100%", height: compact ? 220 : 300, position: "relative" }}>
      <Bar data={data} options={options} />
    </div>
  );
}
