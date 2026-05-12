import OpenAI from "openai";
import { getEmbeddingModel } from "@/lib/config";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const model = getEmbeddingModel();
  const out: number[][] = [];
  const batch = 64;
  for (let i = 0; i < texts.length; i += batch) {
    const slice = texts.slice(i, i + batch);
    const res = await client.embeddings.create({ model, input: slice });
    const ordered = res.data.sort((a, b) => a.index - b.index);
    for (const row of ordered) {
      out.push(row.embedding);
    }
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

/** Map cosine [-1,1] to [0,100] for display */
export function simToScore(sim: number): number {
  return Math.round(((sim + 1) / 2) * 100);
}
