import type { PriceEstimationInput, PriceEstimationResult, PriceEstimationService } from "./PriceEstimationService";

// Falls back to this when OPENAI_API_KEY/REASONING_MODEL aren't configured —
// leaves items unpriced (null) rather than guessing, same gating pattern as
// the other AI-backed providers.
export class StubPriceEstimationProvider implements PriceEstimationService {
  async estimate(items: PriceEstimationInput[], _context: { roomType: string }): Promise<(PriceEstimationResult | null)[]> {
    return items.map(() => null);
  }
}
