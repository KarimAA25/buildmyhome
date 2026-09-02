import type { DesignSpecificationItem } from "@buildmyhome/shared";
import type { CatalogProduct } from "../services/catalog/CatalogService";
import type { EmbeddingService } from "../services/embedding/EmbeddingService";
import { cosineSimilarity } from "../services/productSearch/InMemoryCosineSimilaritySearchProvider";

const MIN_MATCH_SIMILARITY = 0.4;

// The vision model sometimes fails to copy a catalog id exactly (e.g. writes
// "sofa-01" instead of the real "sofa-lshape-beige-01"), leaving an item
// unpriced even when a real catalog match clearly applies. It can also
// occasionally list the same physical item more than once. Both directly
// hurt quote accuracy, so both are corrected here deterministically rather
// than trusted to the model.
export async function refineDetectedItems(
  items: DesignSpecificationItem[],
  catalog: CatalogProduct[],
  embedding: EmbeddingService
): Promise<DesignSpecificationItem[]> {
  const embeddedCatalog = catalog.filter(
    (product): product is CatalogProduct & { embedding: number[] } => Array.isArray(product.embedding)
  );

  const regrounded = await Promise.all(
    items.map(async (item) => {
      if (item.catalogProductId || embeddedCatalog.length === 0) return item;

      const queryEmbedding = await embedding.embed(`${item.description} ${item.category}`);
      let best: { product: CatalogProduct; score: number } | null = null;
      for (const product of embeddedCatalog) {
        const score = cosineSimilarity(queryEmbedding, product.embedding);
        if (!best || score > best.score) best = { product, score };
      }

      return best && best.score >= MIN_MATCH_SIMILARITY ? { ...item, catalogProductId: best.product.id } : item;
    })
  );

  // Merge items that resolved to the same real product into one line with a
  // combined quantity — never merge unmatched items, since there's no shared
  // identifier confirming they're actually the same physical thing.
  const merged = new Map<string, DesignSpecificationItem>();
  const unmatched: DesignSpecificationItem[] = [];

  for (const item of regrounded) {
    if (!item.catalogProductId) {
      unmatched.push(item);
      continue;
    }
    const existing = merged.get(item.catalogProductId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      merged.set(item.catalogProductId, { ...item });
    }
  }

  return [...merged.values(), ...unmatched];
}
