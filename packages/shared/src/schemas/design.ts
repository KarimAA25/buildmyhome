import { z } from "zod";
import { Base64ImageSchema, GenerationStatusSchema, MediaTypeSchema } from "./common";
import { DesignSpecificationSchema } from "./designSpecification";
import { QuoteSchema } from "./quote";

export const EndUserEmailSchema = z.string().email();

// Client-generated on page load per CLAUDE2 §2b. Text, not int, in the DB —
// leading zeros are valid.
export const PromptNumberSchema = z.string().regex(/^\d{6}$/, "Must be a 6-digit number");

// Generated images/room photos are stored in Supabase Storage and returned
// as short-lived signed URLs, not base64, once persistence is real.
export const SignedImageUrlSchema = z.string().url();

// Stage 3: room videos, 2-5s per env-configured MIN/MAX_VIDEO_DURATION_SECONDS
// (enforced server-side via ffprobe, not by this regex).
export const Base64VideoSchema = z
  .string()
  .regex(
    /^data:video\/(mp4|quicktime|webm);base64,[A-Za-z0-9+/]+=*$/,
    "Must be a base64 video data URL (mp4, quicktime, or webm)"
  );
export type Base64Video = z.infer<typeof Base64VideoSchema>;

export const SignedVideoUrlSchema = z.string().url();

export const DesignCreateRequestSchema = z
  .object({
    mediaType: MediaTypeSchema.default("image"),
    originalImage: Base64ImageSchema.optional(),
    originalVideo: Base64VideoSchema.optional(),
    userPrompt: z.string().min(1),
    endUserEmail: EndUserEmailSchema,
    promptNumber: PromptNumberSchema,
  })
  .superRefine((data, ctx) => {
    if (data.mediaType === "image") {
      if (!data.originalImage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "originalImage is required when mediaType is 'image'",
          path: ["originalImage"],
        });
      }
      if (data.originalVideo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "originalVideo must not be sent when mediaType is 'image'",
          path: ["originalVideo"],
        });
      }
    } else {
      if (!data.originalVideo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "originalVideo is required when mediaType is 'video'",
          path: ["originalVideo"],
        });
      }
      if (data.originalImage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "originalImage must not be sent when mediaType is 'video'",
          path: ["originalImage"],
        });
      }
    }
  });
export type DesignCreateRequest = z.infer<typeof DesignCreateRequestSchema>;

const createResponseSharedFields = {
  designId: z.string().uuid(),
  // Echoes the request's promptNumber unless a (contractor_id, prompt_number)
  // collision forced the backend to mint a fresh one — the frontend must
  // detect and display that case (CLAUDE2 §2b).
  promptNumber: PromptNumberSchema,
  versionNumber: z.literal(1),
  designSpecification: DesignSpecificationSchema,
  quote: QuoteSchema,
  sourceUrls: z.array(z.string().url()),
};

export const DesignCreateResponseSchema = z.discriminatedUnion("mediaType", [
  z.object({
    ...createResponseSharedFields,
    mediaType: z.literal("image"),
    generationStatus: z.literal("COMPLETED"),
    generatedImage: SignedImageUrlSchema,
  }),
  z.object({
    ...createResponseSharedFields,
    mediaType: z.literal("video"),
    generationStatus: GenerationStatusSchema,
    // Present only once generationStatus is COMPLETED — Zod can't express
    // "present iff sibling === X" natively, so this is optional and the
    // presence/status pairing is enforced by convention (see PersistenceService).
    generatedVideo: SignedVideoUrlSchema.optional(),
  }),
]);
export type DesignCreateResponse = z.infer<typeof DesignCreateResponseSchema>;

// Stateless no longer applies to modify: the backend loads prior version
// state from persistence via designId instead of the client resending it.
// mediaType is NOT sent here — it comes from the design's own stored value.
export const DesignModifyRequestSchema = z.object({
  designId: z.string().uuid(),
  changeRequest: z.string().min(1),
});
export type DesignModifyRequest = z.infer<typeof DesignModifyRequestSchema>;

const modifyResponseSharedFields = {
  versionNumber: z.number().int().positive(),
  designSpecification: DesignSpecificationSchema,
  quote: QuoteSchema,
  sourceUrls: z.array(z.string().url()),
};

export const DesignModifyResponseSchema = z.discriminatedUnion("mediaType", [
  z.object({
    ...modifyResponseSharedFields,
    mediaType: z.literal("image"),
    generationStatus: z.literal("COMPLETED"),
    generatedImage: SignedImageUrlSchema,
  }),
  z.object({
    ...modifyResponseSharedFields,
    mediaType: z.literal("video"),
    generationStatus: GenerationStatusSchema,
    generatedVideo: SignedVideoUrlSchema.optional(),
  }),
]);
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

const lookupResponseSharedFields = {
  designSpecification: DesignSpecificationSchema,
  quote: QuoteSchema,
  sourceUrls: z.array(z.string().url()),
};

export const DesignLookupResponseSchema = z.discriminatedUnion("mediaType", [
  z.object({
    ...lookupResponseSharedFields,
    mediaType: z.literal("image"),
    generationStatus: z.literal("COMPLETED"),
    generatedImage: SignedImageUrlSchema,
  }),
  z.object({
    ...lookupResponseSharedFields,
    mediaType: z.literal("video"),
    generationStatus: GenerationStatusSchema,
    // Absent while PROCESSING or FAILED — never a raw generation_error either;
    // that stays server-side only (see routes/design.ts).
    generatedVideo: SignedVideoUrlSchema.optional(),
  }),
]);
export type DesignLookupResponse = z.infer<typeof DesignLookupResponseSchema>;
