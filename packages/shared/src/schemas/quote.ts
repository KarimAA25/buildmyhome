import { z } from "zod";

export const QuoteLineItemSchema = z.object({
  itemId: z.string(),
  productId: z.string(),
  productName: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
});
export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;

export const QuoteSchema = z.object({
  lineItems: z.array(QuoteLineItemSchema),
  materialsSubtotal: z.number().nonnegative(),
  laborEstimate: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: z.literal("USD"),
  unpriced: z.array(z.string()),
});
export type Quote = z.infer<typeof QuoteSchema>;
