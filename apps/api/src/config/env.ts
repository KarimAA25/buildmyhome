import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENAI_API_KEY: z.string().default(""),
  REASONING_MODEL: z.string().default(""),
  CHEAP_MODEL: z.string().default(""),
  IMAGE_MODEL: z.string().default(""),
  EMBEDDING_MODEL: z.string().default(""),
  MAX_IMAGE_GENERATION_RETRIES: z.coerce.number().int().nonnegative().default(2),
  API_SHARED_SECRET: z.string().min(1, "API_SHARED_SECRET is required"),
  ALLOWED_ORIGIN: z.string().url(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
  MAX_PROMPT_LENGTH: z.coerce.number().int().positive().default(2000),

  // Stage 2 (CLAUDE2.md)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_STORAGE_BUCKET: z.string().default("design-images"),
  MAX_VERSIONS_PER_DESIGN: z.coerce.number().int().positive().default(3),
  GMAIL_SENDER_ADDRESS: z.string().default(""),
  GMAIL_APP_PASSWORD: z.string().default(""),
  EMAIL_FROM_NAME: z.string().default("BuildMyHome"),
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;
