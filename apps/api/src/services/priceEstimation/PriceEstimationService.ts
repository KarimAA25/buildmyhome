export interface PriceEstimationInput {
  name: string;
  category: string;
  quantity: number;
  unit: string | null;
}

export interface PriceEstimationResult {
  unitPrice: number;
  assumptions: string;
}

// Only called for line items the deterministic match/quotation steps left
// unpriced (no contractor page showed a number). Deliberately separate from
// QuotationService — the actual arithmetic (qty * price) stays pure/code-
// computed; this only supplies a per-unit estimate as an input to it.
export interface PriceEstimationService {
  estimate(items: PriceEstimationInput[], context: { roomType: string }): Promise<(PriceEstimationResult | null)[]>;
}
