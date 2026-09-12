import { z } from "zod";

// Mirrors quote_items.pricing_type / .confidence in the Supabase schema —
// every line item carries one of each, priced or not, so "no price found"
// is a real, visible state rather than an omission.
export const PricingTypeSchema = z.enum([
  "EXACT_PRODUCT",
  "CATALOG_MATERIAL",
  "ESTIMATED_MATERIAL",
  "ESTIMATED_LABOR",
  "ESTIMATED_INSTALLATION",
  "CUSTOM_WORK",
]);
export type PricingType = z.infer<typeof PricingTypeSchema>;

export const ConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

// Shape mirrors quote_items exactly (no design-spec item id column exists
// there per CLAUDE2 §5) so a freshly generated quote and one reconstructed
// from a GET /design/lookup are always structurally identical — the
// frontend's results view (CLAUDE2 §2d) must render both the same way.
export const QuoteLineItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  quantity: z.number().positive(),
  unit: z.string().nullable(),
  // Nullable: a price is never invented. If the contractor's page didn't
  // show one, this is null and confidence is LOW — never a fabricated number.
  unitPrice: z.number().nonnegative().nullable(),
  lineTotal: z.number().nonnegative().nullable(),
  pricingType: PricingTypeSchema,
  confidence: ConfidenceSchema,
  sourceUrl: z.string().url().nullable(),
  assumptions: z.string().nullable(),
});
export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;

export const QuoteSchema = z.object({
  lineItems: z.array(QuoteLineItemSchema),
  currency: z.literal("USD"),
  // Low/high rather than a single total, matching quotes.total_low /
  // total_high. Currently low === high for every quote (no spread
  // methodology has been specified) — the range exists so a real
  // confidence-based spread can be introduced later without a schema change.
  totalLow: z.number().nonnegative().nullable(),
  totalHigh: z.number().nonnegative().nullable(),
});
export type Quote = z.infer<typeof QuoteSchema>;
