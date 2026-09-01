import { z } from "zod";

export const DesignSpecificationItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  catalogProductId: z.string().nullable(),
  quantity: z.number().int().positive(),
  placement: z.string(),
});
export type DesignSpecificationItem = z.infer<typeof DesignSpecificationItemSchema>;

export const DesignSpecificationSchema = z.object({
  roomType: z.string(),
  style: z.string(),
  summary: z.string(),
  colorPalette: z.array(z.string()),
  items: z.array(DesignSpecificationItemSchema),
  notes: z.string().nullable(),
});
export type DesignSpecification = z.infer<typeof DesignSpecificationSchema>;
