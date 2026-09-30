import { z } from "zod";

export const Base64ImageSchema = z
  .string()
  .regex(
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/,
    "Must be a base64 image data URL (png, jpeg, or webp)"
  );
export type Base64Image = z.infer<typeof Base64ImageSchema>;

export const ProgressStateSchema = z.enum([
  "ANALYZING",
  "SEARCHING_PRODUCTS",
  "CREATING_DESIGN",
  "GENERATING_IMAGE",
  "VALIDATING",
  "REVIEWING_RESULT",
  "CALCULATING_QUOTE",
  "COMPLETED",
  "FAILED",
]);
export type ProgressState = z.infer<typeof ProgressStateSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const MediaTypeSchema = z.enum(["image", "video"]);
export type MediaType = z.infer<typeof MediaTypeSchema>;

// Distinct from ProgressState: ProgressState tracks the synchronous SSE
// stream for a single request/response cycle. GenerationStatus tracks a
// design_versions row's async render (Stage 3 video) and outlives the SSE
// connection — it's what GET /design/lookup polling watches.
export const GenerationStatusSchema = z.enum(["PROCESSING", "COMPLETED", "FAILED"]);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;
