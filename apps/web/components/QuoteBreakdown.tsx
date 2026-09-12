import type { Quote } from "@buildmyhome/shared";

const CONFIDENCE_LABEL: Record<Quote["lineItems"][number]["confidence"], string> = {
  HIGH: "",
  MEDIUM: "estimated",
  LOW: "rough estimate",
};

export function QuoteBreakdown({ quote }: { quote: Quote }) {
  const totalLabel =
    quote.totalLow === quote.totalHigh
      ? `$${(quote.totalLow ?? 0).toFixed(2)}`
      : `$${(quote.totalLow ?? 0).toFixed(2)} – $${(quote.totalHigh ?? 0).toFixed(2)}`;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {quote.lineItems.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs text-neutral-400">
              <th className="pb-1 font-normal">Item</th>
              <th className="pb-1 font-normal">Qty</th>
              <th className="pb-1 text-right font-normal">Unit Price</th>
              <th className="pb-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((item, i) => (
              <tr key={`${item.name}-${i}`} className="border-t align-top">
                <td className="py-1">
                  {item.name}
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-xs text-neutral-400 underline"
                    >
                      source
                    </a>
                  )}
                  {CONFIDENCE_LABEL[item.confidence] && (
                    <span className="ml-1 text-xs text-neutral-400">({CONFIDENCE_LABEL[item.confidence]})</span>
                  )}
                </td>
                <td className="py-1">
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                </td>
                <td className="py-1 text-right font-mono">
                  {item.unitPrice != null ? `$${item.unitPrice.toFixed(2)}` : "—"}
                </td>
                <td className="py-1 text-right font-mono">
                  {item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : "not priced"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex justify-between border-t pt-2 font-mono font-semibold">
        <span>Total</span>
        <span>
          {totalLabel} {quote.currency}
        </span>
      </div>
    </div>
  );
}
