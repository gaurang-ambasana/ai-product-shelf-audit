import type { ChartOptions } from "chart.js";

const TICK = "#9aa0b4";
const GRID = "rgba(255,255,255,0.06)";
const TOOLTIP_BG = "#12141a";
const TOOLTIP_BORDER = "rgba(255,255,255,0.1)";

export const chartTickColor = TICK;
export const chartGridColor = GRID;

export const darkTooltipPlugin: NonNullable<ChartOptions["plugins"]>["tooltip"] = {
  backgroundColor: TOOLTIP_BG,
  titleColor: "#e8eaf0",
  bodyColor: TICK,
  borderColor: TOOLTIP_BORDER,
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  displayColors: true,
};
