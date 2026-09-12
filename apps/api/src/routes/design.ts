import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  DesignCreateRequestSchema,
  DesignModifyRequestSchema,
  DesignLookupRequestSchema,
} from "@buildmyhome/shared";
import { env } from "../config/env";
import { services } from "../container";
import { createDesign } from "../pipeline/createDesign";
import { modifyDesign } from "../pipeline/modifyDesign";
import { mapPipelineError } from "./mapPipelineError";
import { startSSE } from "./sse";

// Generation endpoints hit real, metered AI calls — tighter than the
// blanket 100/min default applied to the rest of the API. Retrieval
// (GET /design/lookup) intentionally does NOT get this treatment — CLAUDE2
// §1 rule 3 says no additional protection beyond the global default.
const GENERATION_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

function requireContractor(request: FastifyRequest, reply: FastifyReply): { id: string; email: string } | null {
  const { contractorId, contractorEmail } = request;
  if (!contractorId || !contractorEmail) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing or invalid X-Contractor-Token" } });
    return null;
  }
  return { id: contractorId, email: contractorEmail };
}

export async function designRoutes(app: FastifyInstance) {
  app.post("/design/create", GENERATION_RATE_LIMIT, async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

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
      return await createDesign(contractor.id, contractor.email, parseResult.data);
    } catch (err) {
      request.log.error(err);
      const { status, body } = mapPipelineError(err);
      return reply.code(status).send(body);
    }
  });

  app.post("/design/modify", GENERATION_RATE_LIMIT, async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

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
      return await modifyDesign(contractor.id, contractor.email, parseResult.data);
    } catch (err) {
      request.log.error(err);
      const { status, body } = mapPipelineError(err);
      return reply.code(status).send(body);
    }
  });

  app.post("/design/create/stream", GENERATION_RATE_LIMIT, async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

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
      const result = await createDesign(contractor.id, contractor.email, parseResult.data, (state) =>
        sse.send("progress", { state })
      );
      sse.send("complete", result);
    } catch (err) {
      request.log.error(err);
      const { body } = mapPipelineError(err);
      sse.send("error", body.error);
    } finally {
      sse.end();
    }
  });

  app.post("/design/modify/stream", GENERATION_RATE_LIMIT, async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

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
      const result = await modifyDesign(contractor.id, contractor.email, parseResult.data, (state) =>
        sse.send("progress", { state })
      );
      sse.send("complete", result);
    } catch (err) {
      request.log.error(err);
      const { body } = mapPipelineError(err);
      sse.send("error", body.error);
    } finally {
      sse.end();
    }
  });

  app.get("/design/lookup", async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

    const parseResult = DesignLookupRequestSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }

    const found = await services.persistence.lookup({
      contractorId: contractor.id,
      email: parseResult.data.email,
      promptNumber: parseResult.data.promptNumber,
      versionNumber: parseResult.data.versionNumber,
    });

    // Generic 404 for ANY mismatch — wrong email, wrong prompt number, or a
    // version that was never generated all look identical (CLAUDE2 §1 rule 4).
    if (!found) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "No matching design found." } });
    }

    const generatedImage = await services.storage.getSignedUrl(found.version.generatedImagePath);

    return {
      designSpecification: found.version.designSpecification,
      generatedImage,
      quote: found.version.quote,
      sourceUrls: found.version.sourceUrls,
    };
  });
}
