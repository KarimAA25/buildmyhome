import { z } from "zod";
import { Base64ImageSchema } from "./common";
import { DesignSpecificationSchema } from "./designSpecification";
import { QuoteSchema } from "./quote";
import { EndUserEmailSchema, PromptNumberSchema, SignedImageUrlSchema } from "./design";

export const AstraStartRequestSchema = z.object({
  endUserEmail: EndUserEmailSchema,
  promptNumber: PromptNumberSchema,
  originalImage: Base64ImageSchema,
});
export type AstraStartRequest = z.infer<typeof AstraStartRequestSchema>;

export const AstraStartResponseSchema = z.object({
  designId: z.string().uuid(),
  // Echoes the request's promptNumber unless a (contractor_id, prompt_number)
  // collision forced the backend to mint a fresh one, same as image/video.
  promptNumber: PromptNumberSchema,
  mediaType: z.literal("astra"),
  realtimeSession: z.object({
    token: z.string(),
    expiresAt: z.number(),
  }),
});
export type AstraStartResponse = z.infer<typeof AstraStartResponseSchema>;

// One edit-turn, triggered client-side when the Realtime voice session's
// propose_edit tool fires — carries the user's spoken request verbatim, not
// a pre-parsed instruction (that parsing is the orchestration layer's job).
export const AstraEditRequestSchema = z.object({
  designId: z.string().uuid(),
  userUtterance: z.string().min(1),
});
export type AstraEditRequest = z.infer<typeof AstraEditRequestSchema>;

export const AstraEditResponseSchema = z.object({
  designId: z.string().uuid(),
  generatedImage: SignedImageUrlSchema,
  designSpecification: DesignSpecificationSchema,
  // Short natural-language confirmation for the voice model to speak back,
  // sent to the Realtime session as the function-call output.
  acknowledgement: z.string(),
});
export type AstraEditResponse = z.infer<typeof AstraEditResponseSchema>;

export const AstraFinishRequestSchema = z.object({
  designId: z.string().uuid(),
});
export type AstraFinishRequest = z.infer<typeof AstraFinishRequestSchema>;

export const AstraFinishResponseSchema = z.object({
  designId: z.string().uuid(),
  promptNumber: PromptNumberSchema,
  mediaType: z.literal("astra"),
  designSpecification: DesignSpecificationSchema,
  quote: QuoteSchema,
  sourceUrls: z.array(z.string().url()),
});
export type AstraFinishResponse = z.infer<typeof AstraFinishResponseSchema>;
