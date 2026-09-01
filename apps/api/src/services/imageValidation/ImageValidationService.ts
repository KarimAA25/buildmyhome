import { z } from "zod";
import type { DesignSpecification } from "@buildmyhome/shared";

export const ImageValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().nullable(),
});
export type ImageValidationResult = z.infer<typeof ImageValidationResultSchema>;

export interface ImageValidationService {
  validate(image: string, designSpecification: DesignSpecification): Promise<ImageValidationResult>;
}
