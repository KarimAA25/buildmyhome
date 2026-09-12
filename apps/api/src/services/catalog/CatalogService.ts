import { z } from "zod";
import { PricingTypeSchema, ConfidenceSchema } from "@buildmyhome/shared";

export const CatalogProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  // Nullable: a live-sourced product whose contractor page didn't show a
  // price still needs to exist as a candidate — see CLAUDE2.md §3b. Never
  // fabricate a value here.
  price: z.number().nonnegative().nullable(),
  currency: z.string().default("USD"),
  unit: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  dimensions: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  materials: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  availability: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  // Set by LiveContractorPageProvider at extraction time and carried through
  // to the matching quote_items row by DeterministicQuotationProvider.
  pricingType: PricingTypeSchema.optional(),
  confidence: ConfidenceSchema.optional(),
  assumptions: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  embedding: z.array(z.number()).optional(),
});
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export const CatalogFileSchema = z.object({
  _meta: z
    .object({
      isSampleData: z.boolean().optional(),
      warning: z.string().optional(),
    })
    .optional(),
  products: z.array(CatalogProductSchema),
});

export interface CatalogService {
  getAll(): Promise<CatalogProduct[]>;
  getById(id: string): Promise<CatalogProduct | null>;
}
