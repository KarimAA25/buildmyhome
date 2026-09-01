import type { DesignSpecification, Quote, QuoteLineItem } from "@buildmyhome/shared";
import type { CatalogProduct } from "../catalog/CatalogService";
import type { QuotationService } from "./QuotationService";

// Not sourced from any spec — real values need business input before Phase 7.
const LABOR_RATE_PERCENT = 0;
const TAX_RATE_PERCENT = 0;

export class DeterministicQuotationProvider implements QuotationService {
  calculate(spec: DesignSpecification, catalog: CatalogProduct[]): Quote {
    const catalogById = new Map(catalog.map((product) => [product.id, product]));
    const lineItems: QuoteLineItem[] = [];
    const unpriced: string[] = [];

    for (const item of spec.items) {
      const product = item.catalogProductId ? catalogById.get(item.catalogProductId) : undefined;
      if (!product) {
        unpriced.push(item.id);
        continue;
      }
      lineItems.push({
        itemId: item.id,
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal: product.price * item.quantity,
      });
    }

    const materialsSubtotal = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
    const laborEstimate = materialsSubtotal * LABOR_RATE_PERCENT;
    const tax = (materialsSubtotal + laborEstimate) * TAX_RATE_PERCENT;
    const total = materialsSubtotal + laborEstimate + tax;

    return {
      lineItems,
      materialsSubtotal,
      laborEstimate,
      tax,
      total,
      currency: "USD",
      unpriced,
    };
  }
}
