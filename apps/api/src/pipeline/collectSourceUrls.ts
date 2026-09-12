import type { DesignSpecification } from "@buildmyhome/shared";
import type { CatalogProduct } from "../services/catalog/CatalogService";

// Every generated design/quote must be traceable back to the exact
// contractor page(s) it was drawn from (CLAUDE2 §1 rule 5) — only URLs
// actually referenced by an item that made it into the final spec, never
// every page the contractor happens to have on file.
export function collectSourceUrls(spec: DesignSpecification, candidateProducts: CatalogProduct[]): string[] {
  const byId = new Map(candidateProducts.map((product) => [product.id, product]));
  const urls = new Set<string>();

  for (const item of spec.items) {
    if (!item.catalogProductId) continue;
    const sourceUrl = byId.get(item.catalogProductId)?.sourceUrl;
    if (sourceUrl) urls.add(sourceUrl);
  }

  return [...urls];
}
