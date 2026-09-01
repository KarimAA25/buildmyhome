import type { CatalogProduct } from "../catalog/CatalogService";

export interface ProductSearchService {
  search(queryEmbedding: number[], candidates: CatalogProduct[], topK?: number): Promise<CatalogProduct[]>;
}
