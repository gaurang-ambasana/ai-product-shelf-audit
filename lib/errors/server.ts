import type { AppErrorCode } from "./types";

export type ServerLogContext = {
  route: string;
  code: AppErrorCode;
  message: string;
  cause?: unknown;
  requestId?: string;
  extra?: Record<string, unknown>;
};

export function logServerError(ctx: ServerLogContext): void {
  const err =
    ctx.cause instanceof Error
      ? ctx.cause
      : ctx.cause
        ? new Error(String(ctx.cause))
        : undefined;
  const payload = {
    level: "error",
    scope: "server",
    route: ctx.route,
    code: ctx.code,
    message: ctx.message,
    requestId: ctx.requestId,
    stack: err?.stack,
    extra: ctx.extra,
  };
  console.error(JSON.stringify(payload));
}
