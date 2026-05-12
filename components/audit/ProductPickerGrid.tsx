"use client";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { StorefrontImage } from "@/components/StorefrontImage";
import { HoverLift } from "@/components/motion/interactive";
import type { DiscoveredProduct } from "@/lib/types/crawl";

const CARD_BG = "#1a1a1a";
const CARD_RADIUS = 22;

function formatPrice(p: DiscoveredProduct): string {
  if (p.priceMin == null) return "—";
  const code = (p.currency && p.currency.length === 3 ? p.currency : "USD").toUpperCase();
  try {
    const fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    });
    if (p.priceMax != null && Math.abs(p.priceMax - p.priceMin) > 0.0001) {
      return `${fmt.format(p.priceMin)} – ${fmt.format(p.priceMax)}`;
    }
    return fmt.format(p.priceMin);
  } catch {
    if (p.priceMax != null && p.priceMax !== p.priceMin) {
      return `${p.priceMin} – ${p.priceMax} ${p.currency ?? ""}`.trim();
    }
    return `${p.priceMin} ${p.currency ?? ""}`.trim();
  }
}

export function ProductPickerGrid(props: {
  products: DiscoveredProduct[];
  selected: Set<string>;
  maxSelected: number;
  onToggle: (id: string) => void;
}) {
  const { products, selected, maxSelected, onToggle } = props;

  return (
    <Box
      sx={{
        display: "grid",
        width: "100%",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
        gap: { xs: 1.5, sm: 2 },
        alignItems: "stretch",
      }}
    >
      {products.map((p) => {
        const isSelected = selected.has(p.id);
        const disabled = !isSelected && selected.size >= maxSelected;
        const img = p.images[0];
        const categoryLabel = p.category?.trim() || "General";
        return (
          <HoverLift key={p.id} disabled={disabled}>
            <Card
              component="button"
              type="button"
              aria-pressed={isSelected}
              aria-label={`Select ${p.title}`}
              onClick={() => {
                if (disabled) return;
                onToggle(p.id);
              }}
              disabled={disabled}
              sx={{
                width: "100%",
                height: "100%",
                minHeight: { xs: 340, sm: 380, md: 400 },
                p: 0,
                display: "flex",
                flexDirection: "column",
                textAlign: "left",
                cursor: disabled ? "not-allowed" : "pointer",
                position: "relative",
                overflow: "hidden",
                borderRadius: `${CARD_RADIUS}px`,
                bgcolor: CARD_BG,
                backgroundImage: "none",
                border: "1px solid",
                borderColor: isSelected ? "primary.main" : "rgba(255,255,255,0.08)",
                boxShadow: isSelected
                  ? "0 0 0 1px rgba(124,108,245,0.5), 0 12px 40px rgba(0,0,0,0.45)"
                  : "0 8px 32px rgba(0,0,0,0.35)",
                opacity: disabled && !isSelected ? 0.45 : 1,
                transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
                "&:hover": {
                  borderColor: disabled
                    ? "rgba(255,255,255,0.08)"
                    : isSelected
                      ? "primary.light"
                      : "rgba(255,255,255,0.16)",
                  boxShadow: disabled
                    ? undefined
                    : isSelected
                      ? "0 0 0 1px rgba(124,108,245,0.65), 0 16px 48px rgba(124,108,245,0.12)"
                      : "0 12px 40px rgba(0,0,0,0.5)",
                },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  flex: "0 0 auto",
                  width: "100%",
                  aspectRatio: 4 / 3,
                  bgcolor: "#0d0d0d",
                }}
              >
                {isSelected ? (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      zIndex: 2,
                      borderRadius: "50%",
                      bgcolor: "rgba(0,0,0,0.45)",
                      backdropFilter: "blur(8px)",
                      display: "flex",
                      lineHeight: 0,
                    }}
                  >
                    <CheckCircleIcon sx={{ color: "primary.main", fontSize: 30 }} />
                  </Box>
                ) : null}
                {img ? (
                  <StorefrontImage
                    src={img.url}
                    alt={img.alt ?? p.title}
                    sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  />
                ) : (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ImageNotSupportedOutlinedIcon sx={{ fontSize: 52, opacity: 0.28, color: "text.secondary" }} />
                  </Box>
                )}
              </Box>

              <CardContent
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  px: 2.5,
                  pt: 2.5,
                  pb: 2.5,
                  "&:last-child": { pb: 2.5 },
                }}
              >
                <Chip
                  label={categoryLabel}
                  size="small"
                  variant="outlined"
                  sx={{
                    alignSelf: "flex-start",
                    height: 28,
                    maxWidth: "100%",
                    borderColor: "rgba(255,255,255,0.35)",
                    color: "text.primary",
                    bgcolor: "transparent",
                    fontWeight: 500,
                    fontSize: "0.7rem",
                    letterSpacing: "0.04em",
                    textTransform: "none",
                    "& .MuiChip-label": {
                      px: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                />
                <Typography
                  sx={{
                    mt: 1.5,
                    fontWeight: 500,
                    fontSize: "1rem",
                    lineHeight: 1.35,
                    color: "text.primary",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {p.title}
                </Typography>

                <Box sx={{ flexGrow: 1, minHeight: 20 }} />

                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: "1.35rem",
                    lineHeight: 1.2,
                    color: "#ffffff",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatPrice(p)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: 0.75,
                    display: "block",
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    fontSize: "0.65rem",
                    opacity: 0.85,
                    wordBreak: "break-all",
                  }}
                >
                  Ref. {p.id}
                </Typography>
              </CardContent>
            </Card>
          </HoverLift>
        );
      })}
    </Box>
  );
}
