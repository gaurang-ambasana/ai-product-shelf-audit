"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { MotionConfig } from "framer-motion";
import { appTheme } from "@/lib/theme";
import { ErrorSnackbarProvider } from "./ErrorSnackbarProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={appTheme}>
        <MotionConfig reducedMotion="user">
          <CssBaseline />
          <ErrorSnackbarProvider>{children}</ErrorSnackbarProvider>
        </MotionConfig>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
