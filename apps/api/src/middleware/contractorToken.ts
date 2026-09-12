import type { FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../services/supabaseClient";

const PUBLIC_PATHS = new Set(["/health"]);

declare module "fastify" {
  interface FastifyRequest {
    contractorId?: string;
    contractorEmail?: string;
  }
}

// Resolves X-Contractor-Token -> contractor_id before any design route runs
// (CLAUDE2 §9). contractor_token is the ONLY thing that identifies which
// contractor a request belongs to — never the website_url, never looked up
// any other way.
export async function contractorTokenHook(request: FastifyRequest, reply: FastifyReply) {
  if (PUBLIC_PATHS.has(request.url.split("?")[0])) return;

  const token = request.headers["x-contractor-token"];
  if (typeof token !== "string" || token.length === 0) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing or invalid X-Contractor-Token" } });
    return;
  }

  const { data, error } = await supabase
    .from("contractors")
    .select("id, contact_email")
    .eq("contractor_token", token)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing or invalid X-Contractor-Token" } });
    return;
  }

  request.contractorId = data.id;
  request.contractorEmail = data.contact_email;
}
