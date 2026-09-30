import type { FastifyInstance } from "fastify";
import { AstraStartRequestSchema, AstraEditRequestSchema, AstraFinishRequestSchema } from "@buildmyhome/shared";
import { startAstraSession } from "../pipeline/astra/startAstraSession";
import { applyAstraEdit } from "../pipeline/astra/applyAstraEdit";
import { finishAstraSession } from "../pipeline/astra/finishAstraSession";
import { mapPipelineError } from "./mapPipelineError";
import { requireContractor } from "./design";

// Higher than the 10/min GENERATION_RATE_LIMIT used for discrete
// generate/modify — a live conversation naturally produces more edit-turns
// per minute than a click-driven flow.
const ASTRA_EDIT_RATE_LIMIT = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };
const GENERATION_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export async function astraRoutes(app: FastifyInstance) {
  app.post("/design/astra/start", GENERATION_RATE_LIMIT, async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

    const parseResult = AstraStartRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }

    try {
      return await startAstraSession(contractor.id, contractor.email, parseResult.data);
    } catch (err) {
      request.log.error(err);
      const { status, body } = mapPipelineError(err);
      return reply.code(status).send(body);
    }
  });

  app.post("/design/astra/edit", ASTRA_EDIT_RATE_LIMIT, async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

    const parseResult = AstraEditRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }

    try {
      return await applyAstraEdit(contractor.id, contractor.email, parseResult.data);
    } catch (err) {
      request.log.error(err);
      const { status, body } = mapPipelineError(err);
      return reply.code(status).send(body);
    }
  });

  app.post("/design/astra/finish", GENERATION_RATE_LIMIT, async (request, reply) => {
    const contractor = requireContractor(request, reply);
    if (!contractor) return;

    const parseResult = AstraFinishRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parseResult.error.message } });
    }

    try {
      return await finishAstraSession(contractor.id, contractor.email, parseResult.data);
    } catch (err) {
      request.log.error(err);
      const { status, body } = mapPipelineError(err);
      return reply.code(status).send(body);
    }
  });
}
