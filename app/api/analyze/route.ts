import { analyzeRequestSchema } from "@/lib/types/report";
import { encodeNdjsonLine } from "@/lib/stream/ndjson";
import { runFullAnalysis } from "@/lib/analysis/run-analysis";
import { jsonError, logServerError } from "@/lib/errors";

export const maxDuration = 120;

export async function POST(req: Request) {
  const route = "/api/analyze";
  if (!process.env.OPENAI_API_KEY) {
    logServerError({
      route,
      code: "OPENAI_ERROR",
      message: "Missing OPENAI_API_KEY",
    });
    return jsonError("OPENAI_ERROR");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("BAD_REQUEST");
  }
  const parsed = analyzeRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("BAD_REQUEST");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(encodeNdjsonLine(obj)));
      };
      try {
        const report = await runFullAnalysis({
          ...parsed.data,
          onProgress: (phase, percent, message) => {
            write({ type: "progress", phase, percent, message });
          },
        });
        write({ type: "result", data: report });
      } catch (cause) {
        logServerError({
          route,
          code: "ANALYSIS_FAILED",
          message: "Analysis failed",
          cause,
        });
        write({ type: "error", code: "ANALYSIS_FAILED" as const });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
