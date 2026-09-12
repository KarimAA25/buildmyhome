import type { Quote } from "@buildmyhome/shared";

// Quotation and identifiers only — the generated image is never attached or
// embedded, per CLAUDE2 §4b/§10 rule 12.
export function formatQuoteEmail(quote: Quote): string {
  const lines = quote.lineItems.map((item) => {
    const price = item.unitPrice != null && item.lineTotal != null
      ? `$${item.lineTotal.toFixed(2)} (${item.quantity} x $${item.unitPrice.toFixed(2)})`
      : "price not available";
    return `- ${item.name} x${item.quantity}: ${price}`;
  });

  const total =
    quote.totalLow === quote.totalHigh
      ? `$${(quote.totalLow ?? 0).toFixed(2)}`
      : `$${(quote.totalLow ?? 0).toFixed(2)} - $${(quote.totalHigh ?? 0).toFixed(2)}`;

  return `${lines.join("\n") || "(no line items)"}\n\nTotal: ${total} ${quote.currency}`;
}
