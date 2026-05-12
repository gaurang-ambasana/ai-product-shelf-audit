import { z } from "zod";
import { encodeNdjsonLine } from "@/lib/stream/ndjson";
import { runCrawl } from "@/lib/crawler/orchestrator";
import { jsonError, logServerError } from "@/lib/errors";

export const maxDuration = 120;

const bodySchema = z.object({
  storeUrl: z.string().min(1),
  competitorUrls: z.array(z.string()).max(5).optional().default([]),
});

export async function POST(req: Request) {
  const route = "/api/crawl";
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("BAD_REQUEST");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("BAD_REQUEST");
  }
  const { storeUrl, competitorUrls } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(encodeNdjsonLine(obj)));
      };
      try {
        await runCrawl({
          storeUrl,
          competitorUrls,
          emit: (e) => write(e),
        });
      } catch (cause) {
        logServerError({
          route,
          code: "CRAWL_FAILED",
          message: "Crawl pipeline failed",
          cause,
        });
        write({ type: "error", code: "CRAWL_FAILED" as const });
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
