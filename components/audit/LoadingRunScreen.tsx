"use client";

import AutorenewIcon from "@mui/icons-material/Autorenew";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export function LoadingRunScreen(props: {
  title: string;
  phaseLabel: string;
  message: string;
  percent: number;
}) {
  const pct = Math.max(0, Math.min(100, props.percent));
  return (
    <Box
      sx={{
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        py: 6,
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <SearchIcon sx={{ opacity: 0.8 }} />
        <PsychologyIcon sx={{ opacity: 0.8 }} />
      </Stack>

      <Box
        sx={{
          position: "relative",
          width: 88,
          height: 88,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress
          variant="determinate"
          value={pct}
          size={88}
          thickness={3}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            color: "primary.main",
          }}
        />
        <AutorenewIcon
          sx={{
            fontSize: 34,
            color: "primary.main",
            animation: `${spin} 1.05s linear infinite`,
            zIndex: 1,
          }}
        />
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 600, textAlign: "center" }}>
        {props.title}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ textAlign: "center" }}>
        {props.phaseLabel}
      </Typography>
      <Typography variant="body1" sx={{ maxWidth: 480, textAlign: "center" }}>
        {props.message}
      </Typography>
      <Box sx={{ width: "100%", maxWidth: 440 }}>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 99 }} />
        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", justifyContent: "center" }}>
          <AutorenewIcon
            sx={{
              fontSize: 16,
              color: "text.secondary",
              animation: `${spin} 1.2s linear infinite`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {pct}% done
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
