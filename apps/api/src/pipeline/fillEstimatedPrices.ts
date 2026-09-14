import type { Quote } from "@buildmyhome/shared";
import type { PriceEstimationService } from "../services/priceEstimation/PriceEstimationService";

// Runs after QuotationService.calculate() — that stays pure arithmetic
// (real prices only). This is the explicit fallback for whatever's still
// unpriced: ask the AI for a realistic market estimate, then compute the
// line total in code (qty * price), same as every other line item. Always
// forced to confidence LOW and a disclosed assumption — an estimate must
// never look indistinguishable from a real contractor-sourced price.
export async function fillEstimatedPrices(
  quote: Quote,
  priceEstimation: PriceEstimationService,
  context: { roomType: string }
): Promise<Quote> {
  const unpriced = quote.lineItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.unitPrice == null);

  if (unpriced.length === 0) return quote;

  const estimates = await priceEstimation.estimate(
    unpriced.map(({ item }) => ({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit })),
    context
  );

  const lineItems = quote.lineItems.map((item) => ({ ...item }));
  unpriced.forEach(({ index }, i) => {
    const estimate = estimates[i];
    // AI couldn't estimate this one either — stays honestly null.
    if (!estimate) return;

    const lineItem = lineItems[index];
    lineItem.unitPrice = estimate.unitPrice;
    lineItem.lineTotal = estimate.unitPrice * lineItem.quantity;
    lineItem.confidence = "LOW";
    lineItem.assumptions = [
      "AI-estimated market price — not sourced from the contractor's reference pages.",
      estimate.assumptions,
      lineItem.assumptions,
    ]
      .filter(Boolean)
      .join(" ");
  });

  const total = lineItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  return { ...quote, lineItems, totalLow: total, totalHigh: total };
}
