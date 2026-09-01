import { z } from "zod";

export const CatalogProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  price: z.number().nonnegative(),
  currency: z.string().default("USD"),
  images: z.array(z.string()).optional(),
  dimensions: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  materials: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  availability: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
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
