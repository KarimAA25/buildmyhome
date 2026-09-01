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
} from "@buildmyhome/shared";
import { createDesign, modifyDesign } from "@/lib/apiClient";

// Proxies client-triggered generation requests to apiClient.ts server-side,
// per CLAUDE.md §F: API_SHARED_SECRET must never reach a client component.
export async function generateDesignAction(request: DesignCreateRequest): Promise<DesignCreateResponse> {
  return createDesign(request);
}

export async function modifyDesignAction(request: DesignModifyRequest): Promise<DesignModifyResponse> {
  return modifyDesign(request);
}
