import type { AppErrorCode } from "./types";

export type ClientLogContext = {
  code?: AppErrorCode;
  message: string;
  cause?: unknown;
  extra?: Record<string, unknown>;
};

export function logClientError(ctx: ClientLogContext): void {
  const err =
    ctx.cause instanceof Error
      ? ctx.cause
      : ctx.cause
        ? new Error(String(ctx.cause))
        : undefined;
  console.error("[ai-shelf-audit]", {
    code: ctx.code,
    message: ctx.message,
    stack: err?.stack,
    cause: err?.message,
    extra: ctx.extra,
  });
}
