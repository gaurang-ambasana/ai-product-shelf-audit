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
    .max(5),
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
  primaryStoreLabel: string;
}): Candidate[] {
  const youLabel = opts.primaryStoreLabel;
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
    const key = `${p.productId ?? ""}||${p.storeLabel}||${p.productTitle}`;
    if (!uniq.has(key)) uniq.set(key, p);
  }
  return [...uniq.values()].slice(0, 5).map((p, i) => ({ ...p, rank: i + 1 }));
}

export async function runLiveAiSimulation(opts: {
  crawl: CrawlResult;
  selected: DiscoveredProduct[];
  prompts: string[];
  primaryStoreLabel: string;
}): Promise<{ results: LiveSimResult[]; note: string }> {
  const model = getOpenAIModel();
  const selectedIds = new Set(opts.selected.map((s) => s.id));
  const candidates = buildCandidates({
    crawl: opts.crawl,
    selected: opts.selected,
    maxCompetitorProductsPerStore: 4,
    primaryStoreLabel: opts.primaryStoreLabel,
  });

  const note =
    `Ranks are only among products in this scan (selected items from ${opts.primaryStoreLabel} plus a small sample from each crawled comparison store)—not the open web. The model is instructed not to favor ${opts.primaryStoreLabel}; weak matches can be omitted from the top 5.`;

  async function simulateOnePrompt(prompt: string): Promise<LiveSimResult | null> {
    const payload = {
      prompt,
      auditedStoreLabel: opts.primaryStoreLabel,
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

    const user = `You are simulating a shopping assistant for a skeptical user.

From the JSON "candidates" only, pick up to 5 products that best fit "prompt". Rank 1 = strongest fit.

Rules:
- Use only the given title, descriptionExcerpt, and optional price fields. Do not invent facts. Do not claim you searched the web or visited URLs.
- Do not favor the audited store (${opts.primaryStoreLabel}) because it is the subject of this audit. If its products are a weak or partial match, rank them low or leave them out of picks entirely.
- Prefer clear relevance to the prompt over brand familiarity.
- Copy storeLabel, productTitle, and productId exactly from the matching candidate row. If nothing fits well, return fewer than 5 picks.
- Return strict JSON only.

Return object shape:
{
  "prompt": string,
  "picks": [{"rank": 1..5, "storeLabel": string, "productTitle": string, "productId": string|null, "url": string|null, "reason": string}]
}

Context JSON:
${JSON.stringify(payload)}`;

    const res = await getClient().chat.completions.create({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return JSON only. Keep reasons short and non-technical. Do not claim you searched the web. Be conservative: omit weak matches rather than filling slots.",
        },
        { role: "user", content: user },
      ],
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    let parsed: z.infer<typeof schema>;
    try {
      const json = JSON.parse(raw) as unknown;
      const pr = schema.safeParse(json);
      if (!pr.success) return null;
      parsed = pr.data;
    } catch {
      return null;
    }

    const picks = clampTop5(parsed.picks);
    const enriched = picks.map((p) => {
      const matchedById =
        p.productId != null
          ? candidates.find((x) => x.productId === p.productId)
          : undefined;
      const matched =
        matchedById ??
        candidates.find(
          (x) =>
            x.title === p.productTitle &&
            (x.storeLabel === p.storeLabel || (x.isYou && p.storeLabel === opts.primaryStoreLabel)),
        );
      const storeLabel =
        p.productId != null && selectedIds.has(p.productId)
          ? opts.primaryStoreLabel
          : p.storeLabel;
      const pick = { ...p, storeLabel };
      return {
        ...pick,
        imageUrl: matched?.imageUrl ?? null,
        imageAlt: matched?.imageAlt ?? null,
        url: pick.url ?? matched?.url ?? null,
      };
    });

    const your = enriched.filter(
      (p) => p.productId != null && selectedIds.has(p.productId),
    );
    const yourBestRank = your.length ? Math.min(...your.map((p) => p.rank)) : null;
    const winnerStoreLabel = enriched[0]?.storeLabel ?? null;

    return {
      prompt,
      picks: enriched,
      yourProductShown: your.length > 0,
      yourBestRank,
      winnerStoreLabel,
    };
  }

  const ordered = await Promise.all(opts.prompts.map((prompt) => simulateOnePrompt(prompt)));
  const results = ordered.filter((r): r is LiveSimResult => r !== null);

  return { results, note };
}

