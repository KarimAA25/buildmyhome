import { z } from "zod";
import { Base64ImageSchema } from "./common";
import { DesignSpecificationSchema } from "./designSpecification";
import { QuoteSchema } from "./quote";

export const DesignCreateRequestSchema = z.object({
  originalImage: Base64ImageSchema,
  userPrompt: z.string().min(1),
});
export type DesignCreateRequest = z.infer<typeof DesignCreateRequestSchema>;

export const DesignCreateResponseSchema = z.object({
  designSpecification: DesignSpecificationSchema,
  generatedImage: Base64ImageSchema,
  quote: QuoteSchema,
  version: z.literal(1),
});
export type DesignCreateResponse = z.infer<typeof DesignCreateResponseSchema>;

export const DesignModifyRequestSchema = z.object({
  currentImage: Base64ImageSchema,
  currentDesignSpecification: DesignSpecificationSchema,
  changeRequest: z.string().min(1),
  versionNumber: z.number().int().positive(),
});
export type DesignModifyRequest = z.infer<typeof DesignModifyRequestSchema>;

export const DesignModifyResponseSchema = z.object({
  designSpecification: DesignSpecificationSchema,
  generatedImage: Base64ImageSchema,
  quote: QuoteSchema,
  version: z.number().int().positive(),
});
export type DesignModifyResponse = z.infer<typeof DesignModifyResponseSchema>;
