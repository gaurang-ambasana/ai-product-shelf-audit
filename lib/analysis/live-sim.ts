import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIModel } from "@/lib/config";
import type { CrawlResult, DiscoveredProduct } from "@/lib/types/crawl";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

export type LiveSimResult = {
  prompt: string;
  picks: Array<{
    rank: number;
    storeLabel: string;
    productTitle: string;
    productId: string | null;
    url: string | null;
    reason: string;
    imageUrl?: string | null;
    imageAlt?: string | null;
  }>;
  yourProductShown: boolean;
  yourBestRank: number | null;
  winnerStoreLabel: string | null;
};

const schema = z.object({
  prompt: z.string(),
  picks: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(5),
        storeLabel: z.string(),
        productTitle: z.string(),
        productId: z.string().nullable(),
        url: z.string().nullable(),
        reason: z.string(),
      }),
    )
    .min(1),
});

type Candidate = {
  storeLabel: string;
  productId: string | null;
  title: string;
  url: string | null;
  descriptionExcerpt: string;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  isYou: boolean;
};

function hostnameLabel(origin: string): string {
  try {
    return new URL(origin).hostname.replace(/^www\./, "") || origin;
  } catch {
    return origin;
  }
}

function buildCandidates(opts: {
  crawl: CrawlResult;
  selected: DiscoveredProduct[];
  maxCompetitorProductsPerStore: number;
}): Candidate[] {
  const youLabel = "Your store";
  const you = opts.selected.map((p) => {
    const img = p.images[0];
    return {
      storeLabel: youLabel,
      productId: p.id,
      title: p.title,
      url: p.url ?? null,
      descriptionExcerpt: p.descriptionText.slice(0, 700),
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      currency: p.currency,
      imageUrl: img?.url ?? null,
      imageAlt: img?.alt ?? p.title ?? null,
      isYou: true,
    } satisfies Candidate;
  });

  const competitors = opts.crawl.competitors.flatMap((c, idx) => {
    const storeLabel = hostnameLabel(c.origin) || `Other store ${idx + 1}`;
    return c.products.slice(0, opts.maxCompetitorProductsPerStore).map((p) => {
      const img = p.images[0];
      return {
        storeLabel,
        productId: null,
        title: p.title,
        url: p.url ?? null,
        descriptionExcerpt: p.descriptionText.slice(0, 500),
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        currency: p.currency,
        imageUrl: img?.url ?? null,
        imageAlt: img?.alt ?? p.title ?? null,
        isYou: false,
      } satisfies Candidate;
    });
  });

  return [...you, ...competitors];
}

function clampTop5(picks: z.infer<typeof schema>["picks"]) {
  const uniq = new Map<string, z.infer<typeof schema>["picks"][number]>();
  for (const p of picks) {
    const key = `${p.storeLabel}||${p.productTitle}`;
    if (!uniq.has(key)) uniq.set(key, p);
  }
  return [...uniq.values()].slice(0, 5).map((p, i) => ({ ...p, rank: i + 1 }));
}

export async function runLiveAiSimulation(opts: {
  crawl: CrawlResult;
  selected: DiscoveredProduct[];
  prompts: string[];
}): Promise<{ results: LiveSimResult[]; note: string }> {
  const model = getOpenAIModel();
  const candidates = buildCandidates({
    crawl: opts.crawl,
    selected: opts.selected,
    maxCompetitorProductsPerStore: 4,
  });

  const note =
    "Picks are only from your selected products in this scan. Names of other brands for the same question appear under Competition → “Who shoppers might hear about.”";

  const results: LiveSimResult[] = [];
  for (const prompt of opts.prompts) {
    const payload = {
      prompt,
      candidates: candidates.map((c) => ({
        storeLabel: c.storeLabel,
        productId: c.productId,
        title: c.title,
        url: c.url,
        descriptionExcerpt: c.descriptionExcerpt,
        priceMin: c.priceMin,
        priceMax: c.priceMax,
        currency: c.currency,
      })),
    };

    const user = `You are simulating a shopping assistant.\n\nChoose up to 5 best product matches from the candidates for the prompt.\n- Prefer products whose title/description clearly match the prompt.\n- If details are missing, do not guess.\n- Return strict JSON only.\n\nReturn object shape:\n{\n  \"prompt\": string,\n  \"picks\": [{\"rank\": 1..5, \"storeLabel\": string, \"productTitle\": string, \"productId\": string|null, \"url\": string|null, \"reason\": string}]\n}\n\nContext JSON:\n${JSON.stringify(payload)}`;

    const res = await getClient().chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return JSON only. Keep reasons short and non-technical. Do not claim you searched the web.",
        },
        { role: "user", content: user },
      ],
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) continue;
    let parsed: z.infer<typeof schema>;
    try {
      const json = JSON.parse(raw) as unknown;
      const pr = schema.safeParse(json);
      if (!pr.success) continue;
      parsed = pr.data;
    } catch {
      continue;
    }

    const picks = clampTop5(parsed.picks);
    const enriched = picks.map((p) => {
      const c = candidates.find(
        (x) =>
          x.storeLabel === p.storeLabel &&
          (x.productId ? x.productId === p.productId : x.title === p.productTitle),
      );
      return {
        ...p,
        imageUrl: c?.imageUrl ?? null,
        imageAlt: c?.imageAlt ?? null,
      };
    });

    const your = enriched.filter((p) => p.storeLabel === "Your store");
    const yourBestRank = your.length ? Math.min(...your.map((p) => p.rank)) : null;
    const winnerStoreLabel = enriched[0]?.storeLabel ?? null;

    results.push({
      prompt,
      picks: enriched,
      yourProductShown: your.length > 0,
      yourBestRank,
      winnerStoreLabel,
    });
  }

  return { results, note };
}

