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
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;
