import { NextResponse } from "next/server";
import type { AppErrorCode, PublicErrorBody } from "./types";
import { toUserMessage } from "./user-messages";

export function jsonError(
  code: AppErrorCode,
  opts?: { status?: number; requestId?: string },
): NextResponse<PublicErrorBody> {
  const status = opts?.status ?? (code === "BAD_REQUEST" || code === "INVALID_URL" ? 400 : 500);
  const body: PublicErrorBody = {
    code,
    message: toUserMessage(code),
    requestId: opts?.requestId,
  };
  return NextResponse.json(body, { status });
}
