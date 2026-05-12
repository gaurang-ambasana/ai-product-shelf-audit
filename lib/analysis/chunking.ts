import type { DiscoveredProduct } from "@/lib/types/crawl";

export type TextChunk = {
  id: string;
  productId: string;
  text: string;
};

export function buildChunksForProduct(p: DiscoveredProduct): TextChunk[] {
  const chunks: TextChunk[] = [];
  const base = [
    p.title,
    p.descriptionText,
    p.evidence.metaDescription ?? "",
    p.evidence.ogDescription ?? "",
    p.evidence.specs.join("\n"),
  ]
    .join("\n\n")
    .slice(0, 12_000);

  chunks.push({
    id: `${p.id}-main`,
    productId: p.id,
    text: base,
  });

  if (p.images.length) {
    const alts = p.images
      .map((i) => i.alt)
      .filter(Boolean)
      .join("; ");
    if (alts) {
      chunks.push({
        id: `${p.id}-alts`,
        productId: p.id,
        text: `Image descriptions: ${alts}`,
      });
    }
  }

  return chunks;
}

export function buildBrandCorpusChunks(products: DiscoveredProduct[]): TextChunk[] {
  return products.flatMap(buildChunksForProduct);
}
