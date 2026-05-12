"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import "@/lib/chart/register";
import { chartGridColor, chartTickColor, darkTooltipPlugin } from "@/lib/chart/theme";

const SERIES_COLORS = ["#7c6cf5", "#22d3ee", "#f472b6", "#fbbf24"];

export function SimulationBarChart({
  simData,
  rankLabels,
}: {
  simData: Record<string, string | number>[];
  rankLabels: string[];
}) {
  const { data, options } = useMemo(() => {
    const labels = simData.map((row) => String(row.prompt));
    const datasets = rankLabels.map((label, i) => ({
      label,
      data: simData.map((row) => Number(row[label]) || 0),
      backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
      borderRadius: 4,
      borderSkipped: false as const,
    }));

    const options: ChartOptions<"bar"> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        tooltip: darkTooltipPlugin,
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 14,
            color: chartTickColor,
            font: { size: 12 },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: chartTickColor,
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 22,
            autoSkip: true,
            maxTicksLimit: 12,
          },
          grid: { color: chartGridColor },
          border: { color: chartGridColor },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: chartTickColor, font: { size: 12 } },
          grid: { color: chartGridColor },
          border: { color: chartGridColor },
        },
      },
    };

    return {
      data: { labels, datasets },
      options,
    };
  }, [simData, rankLabels]);

  if (rankLabels.length === 0 || simData.length === 0) {
    return null;
  }

  return <Bar data={data} options={options} />;
}
