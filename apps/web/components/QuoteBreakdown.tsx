import type { Quote } from "@buildmyhome/shared";

export function QuoteBreakdown({ quote }: { quote: Quote }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {quote.lineItems.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs text-neutral-400">
              <th className="pb-1 font-normal">Item</th>
              <th className="pb-1 font-normal">Qty</th>
              <th className="pb-1 text-right font-normal">Unit</th>
              <th className="pb-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((item) => (
              <tr key={item.itemId} className="border-t">
                <td className="py-1">{item.productName}</td>
                <td className="py-1">{item.quantity}</td>
                <td className="py-1 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">${item.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {quote.unpriced.length > 0 && (
        <p className="text-xs text-neutral-400">Not priced (no catalog match): {quote.unpriced.join(", ")}</p>
      )}

      <div className="flex flex-col gap-0.5 border-t pt-2 font-mono">
        <div className="flex justify-between">
          <span>Materials</span>
          <span>${quote.materialsSubtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Labor</span>
          <span>${quote.laborEstimate.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>${quote.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>${quote.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
