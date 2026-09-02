import type { CatalogProduct } from "../catalog/CatalogService";
import type { ProductSearchService } from "./ProductSearchService";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class InMemoryCosineSimilaritySearchProvider implements ProductSearchService {
  async search(queryEmbedding: number[], candidates: CatalogProduct[], topK = 5): Promise<CatalogProduct[]> {
    return candidates
      .filter((candidate) => Array.isArray(candidate.embedding))
      .map((candidate) => ({
        candidate,
        score: cosineSimilarity(queryEmbedding, candidate.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ candidate }) => candidate);
  }
}
