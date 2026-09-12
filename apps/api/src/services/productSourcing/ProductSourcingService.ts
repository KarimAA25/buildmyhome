import type { CatalogProduct } from "../catalog/CatalogService";

export interface ProductSourcingContext {
  roomType: string;
  requestText: string;
}

// Replaces CatalogService + EmbeddingService + ProductSearchService for the
// live path (CLAUDE2.md §3): there is no stored catalog to search, so
// "search" collapses into "read the contractor's own pages right now and
// extract what's there." The returned CatalogProduct[] is consumed exactly
// like the old static catalog was — design generation, image-diff grounding,
// and quotation are all unchanged downstream of this call.
export interface ProductSourcingService {
  getCandidateProducts(contractorId: string, context: ProductSourcingContext): Promise<CatalogProduct[]>;
}
