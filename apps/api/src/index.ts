import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env";
import { apiSecretHook } from "./middleware/apiSecret";
import { healthRoutes } from "./routes/health";
import { designRoutes } from "./routes/design";

async function main() {
  const app = Fastify({
    logger: true,
    bodyLimit: env.MAX_UPLOAD_BYTES,
  });

  await app.register(cors, {
    origin: env.ALLOWED_ORIGIN,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  app.addHook("onRequest", apiSecretHook);

  await app.register(healthRoutes);
  await app.register(designRoutes);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
