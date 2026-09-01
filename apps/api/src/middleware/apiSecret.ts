import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";

const PUBLIC_PATHS = new Set(["/health"]);

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function apiSecretHook(request: FastifyRequest, reply: FastifyReply) {
  if (PUBLIC_PATHS.has(request.url.split("?")[0])) return;

  const provided = request.headers["x-api-secret"];
  if (typeof provided !== "string" || !secretsMatch(provided, env.API_SHARED_SECRET)) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing or invalid X-API-Secret" } });
  }
}
