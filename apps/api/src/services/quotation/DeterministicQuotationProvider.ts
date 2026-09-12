import type { DesignSpecification, Quote, QuoteLineItem } from "@buildmyhome/shared";
import type { CatalogProduct } from "../catalog/CatalogService";
import type { QuotationService } from "./QuotationService";

export class DeterministicQuotationProvider implements QuotationService {
  calculate(spec: DesignSpecification, catalog: CatalogProduct[]): Quote {
    const catalogById = new Map(catalog.map((product) => [product.id, product]));
    const lineItems: QuoteLineItem[] = [];

    for (const item of spec.items) {
      const product = item.catalogProductId ? catalogById.get(item.catalogProductId) : undefined;

      if (!product) {
        // Detected in the image but not traceable to any contractor
        // reference page — still a real line item (never silently dropped),
        // just an unpriced one. Never invent a price for it.
        lineItems.push({
          name: item.description,
          category: item.category,
          quantity: item.quantity,
          unit: null,
          unitPrice: null,
          lineTotal: null,
          pricingType: "CUSTOM_WORK",
          confidence: "LOW",
          sourceUrl: null,
          assumptions: "No matching product found on the contractor's reference pages.",
        });
        continue;
      }

      const unitPrice = product.price;
      const lineTotal = unitPrice != null ? unitPrice * item.quantity : null;

      lineItems.push({
        name: product.name,
        category: product.category,
        quantity: item.quantity,
        unit: product.unit ?? null,
        unitPrice,
        lineTotal,
        pricingType: product.pricingType ?? (unitPrice != null ? "EXACT_PRODUCT" : "ESTIMATED_MATERIAL"),
        confidence: product.confidence ?? (unitPrice != null ? "HIGH" : "LOW"),
        sourceUrl: product.sourceUrl ?? null,
        assumptions: product.assumptions ?? null,
      });
    }

    // Every line with a real price contributes to the total; unpriced lines
    // contribute nothing rather than a fabricated number. Low/high currently
    // collapse to the same figure — see Quote's totalLow/totalHigh comment
    // in packages/shared for why the range exists anyway.
    const pricedTotal = lineItems.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);

    return {
      lineItems,
      currency: "USD",
      totalLow: pricedTotal,
      totalHigh: pricedTotal,
    };
  }
}
