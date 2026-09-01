import type { FastifyInstance } from "fastify";
import { DesignCreateRequestSchema, DesignModifyRequestSchema } from "@buildmyhome/shared";
import { env } from "../config/env";
import { createDesign } from "../pipeline/createDesign";
import { modifyDesign } from "../pipeline/modifyDesign";
import { startSSE } from "./sse";

// Generation endpoints hit real, metered AI calls — tighter than the
// blanket 100/min default applied to the rest of the API.
const GENERATION_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export async function designRoutes(app: FastifyInstance) {
  app.post("/design/create", GENERATION_RATE_LIMIT, async (request, reply) => {
    const parseResult = DesignCreateRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }

    if (parseResult.data.userPrompt.length > env.MAX_PROMPT_LENGTH) {
      return reply.code(400).send({
        error: { code: "PROMPT_TOO_LONG", message: `userPrompt exceeds ${env.MAX_PROMPT_LENGTH} characters` },
      });
    }

    try {
      return await createDesign(parseResult.data);
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: { code: "GENERATION_FAILED", message: "Failed to generate design." } });
    }
  });

  app.post("/design/modify", GENERATION_RATE_LIMIT, async (request, reply) => {
    const parseResult = DesignModifyRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }

    if (parseResult.data.changeRequest.length > env.MAX_PROMPT_LENGTH) {
      return reply.code(400).send({
        error: { code: "PROMPT_TOO_LONG", message: `changeRequest exceeds ${env.MAX_PROMPT_LENGTH} characters` },
      });
    }

    try {
      return await modifyDesign(parseResult.data);
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: { code: "GENERATION_FAILED", message: "Failed to modify design." } });
    }
  });

  app.post("/design/create/stream", GENERATION_RATE_LIMIT, async (request, reply) => {
    const parseResult = DesignCreateRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }
    if (parseResult.data.userPrompt.length > env.MAX_PROMPT_LENGTH) {
      return reply.code(400).send({
        error: { code: "PROMPT_TOO_LONG", message: `userPrompt exceeds ${env.MAX_PROMPT_LENGTH} characters` },
      });
    }

    const sse = startSSE(reply);
    try {
      const result = await createDesign(parseResult.data, (state) => sse.send("progress", { state }));
      sse.send("complete", result);
    } catch (err) {
      request.log.error(err);
      sse.send("error", { code: "GENERATION_FAILED", message: "Failed to generate design." });
    } finally {
      sse.end();
    }
  });

  app.post("/design/modify/stream", GENERATION_RATE_LIMIT, async (request, reply) => {
    const parseResult = DesignModifyRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }
    if (parseResult.data.changeRequest.length > env.MAX_PROMPT_LENGTH) {
      return reply.code(400).send({
        error: { code: "PROMPT_TOO_LONG", message: `changeRequest exceeds ${env.MAX_PROMPT_LENGTH} characters` },
      });
    }

    const sse = startSSE(reply);
    try {
      const result = await modifyDesign(parseResult.data, (state) => sse.send("progress", { state }));
      sse.send("complete", result);
    } catch (err) {
      request.log.error(err);
      sse.send("error", { code: "GENERATION_FAILED", message: "Failed to modify design." });
    } finally {
      sse.end();
    }
  });
}
