"use client";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

export default function Home() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        background:
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(124,108,245,0.35), transparent), #0b0c0f",
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.2em" }}>
            For merchants & marketers
          </Typography>
          <Typography variant="h3" sx={{ letterSpacing: "-0.03em", fontWeight: 700 }}>
            Product shelf check
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 560, fontWeight: 400 }}>
            See how clear and complete your product pages look—using only your public site. Helpful alongside SEO;
            focused on how people (and shopping tools) understand what you sell.
          </Typography>
          <Box>
            <Button
              component={Link}
              href="/audit"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ px: 3 }}
            >
              Check my shelf
            </Button>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
