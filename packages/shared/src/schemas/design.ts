import { z } from "zod";
import { Base64ImageSchema } from "./common";
import { DesignSpecificationSchema } from "./designSpecification";
import { QuoteSchema } from "./quote";

export const EndUserEmailSchema = z.string().email();

// Client-generated on page load per CLAUDE2 §2b. Text, not int, in the DB —
// leading zeros are valid.
export const PromptNumberSchema = z.string().regex(/^\d{6}$/, "Must be a 6-digit number");

// Generated images/room photos are stored in Supabase Storage and returned
// as short-lived signed URLs, not base64, once persistence is real.
export const SignedImageUrlSchema = z.string().url();

export const DesignCreateRequestSchema = z.object({
  originalImage: Base64ImageSchema,
  userPrompt: z.string().min(1),
  endUserEmail: EndUserEmailSchema,
  promptNumber: PromptNumberSchema,
});
export type DesignCreateRequest = z.infer<typeof DesignCreateRequestSchema>;

export const DesignCreateResponseSchema = z.object({
  designId: z.string().uuid(),
  // Echoes the request's promptNumber unless a (contractor_id, prompt_number)
  // collision forced the backend to mint a fresh one — the frontend must
  // detect and display that case (CLAUDE2 §2b).
  promptNumber: PromptNumberSchema,
  versionNumber: z.literal(1),
  designSpecification: DesignSpecificationSchema,
  generatedImage: SignedImageUrlSchema,
  quote: QuoteSchema,
  sourceUrls: z.array(z.string().url()),
});
export type DesignCreateResponse = z.infer<typeof DesignCreateResponseSchema>;

// Stateless no longer applies to modify: the backend loads prior version
// state from persistence via designId instead of the client resending it.
export const DesignModifyRequestSchema = z.object({
  designId: z.string().uuid(),
  changeRequest: z.string().min(1),
});
export type DesignModifyRequest = z.infer<typeof DesignModifyRequestSchema>;

export const DesignModifyResponseSchema = z.object({
  versionNumber: z.number().int().positive(),
  designSpecification: DesignSpecificationSchema,
  generatedImage: SignedImageUrlSchema,
  quote: QuoteSchema,
  sourceUrls: z.array(z.string().url()),
});
export type DesignModifyResponse = z.infer<typeof DesignModifyResponseSchema>;

export const VersionLimitErrorSchema = z.object({
  error: z.object({
    code: z.literal("VERSION_LIMIT_REACHED"),
    message: z.string(),
    maxVersions: z.number().int().positive(),
    currentVersionCount: z.number().int().positive(),
  }),
});
export type VersionLimitError = z.infer<typeof VersionLimitErrorSchema>;

export const DesignLookupRequestSchema = z.object({
  email: EndUserEmailSchema,
  promptNumber: PromptNumberSchema,
  versionNumber: z.coerce.number().int().positive(),
});
export type DesignLookupRequest = z.infer<typeof DesignLookupRequestSchema>;

export const DesignLookupResponseSchema = z.object({
  designSpecification: DesignSpecificationSchema,
  generatedImage: SignedImageUrlSchema,
  quote: QuoteSchema,
  sourceUrls: z.array(z.string().url()),
});
export type DesignLookupResponse = z.infer<typeof DesignLookupResponseSchema>;
