import type { FastifyInstance } from "fastify";
import { HealthResponseSchema } from "@buildmyhome/shared";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return HealthResponseSchema.parse({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });
}
