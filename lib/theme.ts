import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: "#7c6cf5" },
    secondary: { main: "#22d3ee" },
    background: {
      default: "#0b0c0f",
      paper: "#12141a",
    },
    text: {
      primary: "#f4f4f8",
      secondary: "#9aa0b4",
    },
    divider: "rgba(255,255,255,0.08)",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    h1: { fontWeight: 600, letterSpacing: "-0.03em" },
    h2: { fontWeight: 600, letterSpacing: "-0.02em" },
    h3: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "a[href]": { cursor: "pointer" },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
      styleOverrides: {
        root: {
          cursor: "pointer",
          "&.Mui-disabled": {
            cursor: "not-allowed",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          cursor: "pointer",
          "&.Mui-disabled": {
            cursor: "not-allowed",
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          cursor: "pointer",
          "&.Mui-disabled": {
            cursor: "not-allowed",
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          cursor: "pointer",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "&.MuiChip-clickable": {
            cursor: "pointer",
          },
          "&.Mui-disabled": {
            cursor: "not-allowed",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255,255,255,0.06)",
        },
      },
    },
  },
});
