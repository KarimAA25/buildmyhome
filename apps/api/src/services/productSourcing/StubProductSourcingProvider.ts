import type { CatalogProduct } from "../catalog/CatalogService";
import type { ProductSourcingContext, ProductSourcingService } from "./ProductSourcingService";

// Falls back to this (same hasReasoningConfig gate as the other AI-backed
// providers) when OPENAI_API_KEY/REASONING_MODEL aren't configured. Returns
// no candidates — design generation and quotation both already degrade
// gracefully with an empty candidate list (everything ends up unpriced
// rather than crashing), matching CLAUDE2 §3d's "degrade gracefully" rule.
export class StubProductSourcingProvider implements ProductSourcingService {
  async getCandidateProducts(_contractorId: string, _context: ProductSourcingContext): Promise<CatalogProduct[]> {
    return [];
  }
}
