"use client";

import CloseIcon from "@mui/icons-material/Close";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ErrorCtx = {
  showError: (message: string) => void;
};

const Ctx = createContext<ErrorCtx | null>(null);

export function useErrorSnackbar(): ErrorCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useErrorSnackbar must be used within ErrorSnackbarProvider");
  return v;
}

export function ErrorSnackbarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const showError = useCallback((msg: string) => {
    setMessage(msg);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ showError }), [showError]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={8000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 2 }}
      >
        <Alert
          severity="error"
          variant="filled"
          action={
            <IconButton size="small" color="inherit" onClick={() => setOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{ width: "100%", alignItems: "center" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}
