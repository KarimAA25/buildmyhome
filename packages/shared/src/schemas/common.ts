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
  "CALCULATING_QUOTE",
  "GENERATING_IMAGE",
  "VALIDATING",
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
