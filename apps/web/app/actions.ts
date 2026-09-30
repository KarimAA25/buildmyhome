"use server";

// NOTE: chained AI calls here can take well over a minute. Irrelevant to local
// `next dev`, but Vercel's default serverless timeout is much shorter — when
// this deploys, a maxDuration/route-segment config will need to live wherever
// Next allows it for this deployment target, since "use server" files can only
// export async functions.

import type {
  DesignCreateRequest,
  DesignCreateResponse,
  DesignModifyRequest,
  DesignModifyResponse,
  DesignLookupRequest,
  DesignLookupResponse,
  AstraStartRequest,
  AstraStartResponse,
  AstraFinishRequest,
  AstraFinishResponse,
} from "@buildmyhome/shared";
import {
  createDesign,
  modifyDesign,
  lookupDesign,
  startAstraSession,
  finishAstraSession,
  ApiRequestError,
} from "@/lib/apiClient";

// Proxies client-triggered generation requests to apiClient.ts server-side,
// per CLAUDE.md §F: API_SHARED_SECRET/CONTRACTOR_TOKEN must never reach a
// client component.
export async function generateDesignAction(request: DesignCreateRequest): Promise<DesignCreateResponse> {
  return createDesign(request);
}

export async function modifyDesignAction(request: DesignModifyRequest): Promise<DesignModifyResponse> {
  return modifyDesign(request);
}

// Astra's edit-turn deliberately goes through a Route Handler instead
// (apps/web/app/api/design/astra/edit/route.ts), not a Server Action here —
// only Route Handlers can set maxDuration in this codebase.
export async function startAstraSessionAction(request: AstraStartRequest): Promise<AstraStartResponse> {
  return startAstraSession(request);
}

export async function finishAstraSessionAction(request: AstraFinishRequest): Promise<AstraFinishResponse> {
  return finishAstraSession(request);
}

export type LookupResult = { ok: true; data: DesignLookupResponse } | { ok: false };

// Next.js strips custom error properties when a thrown error crosses the
// server-action boundary (only a redacted digest survives) — returning a
// plain result instead of throwing keeps this reliable. Every failure looks
// identical from here on, matching the generic "no such record" rule
// (CLAUDE2 §1 rule 4) — there's nothing worth distinguishing on the client.
export async function lookupDesignAction(request: DesignLookupRequest): Promise<LookupResult> {
  try {
    const data = await lookupDesign(request);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiRequestError) return { ok: false };
    throw err;
  }
}
