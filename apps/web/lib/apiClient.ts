import {
  HealthResponseSchema,
  DesignCreateRequestSchema,
  DesignCreateResponseSchema,
  DesignModifyRequestSchema,
  DesignModifyResponseSchema,
  DesignLookupRequestSchema,
  DesignLookupResponseSchema,
  type HealthResponse,
  type DesignCreateRequest,
  type DesignCreateResponse,
  type DesignModifyRequest,
  type DesignModifyResponse,
  type DesignLookupRequest,
  type DesignLookupResponse,
} from "@buildmyhome/shared";

// The only module in apps/web allowed to call fetch against apps/api.
// Components and pages must go through the functions exported here —
// never call fetch or hold business logic directly.

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_SECRET = process.env.API_SHARED_SECRET;
// Identifies which contractor this deployment belongs to — server-side only,
// never NEXT_PUBLIC_ (CLAUDE2 §7).
const CONTRACTOR_TOKEN = process.env.CONTRACTOR_TOKEN;

// Carries the parsed error body (code, message, and for VERSION_LIMIT_REACHED
// the maxVersions/currentVersionCount fields) so callers can branch on it
// instead of just getting a generic failure.
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function extractError(json: unknown): { code: string | null; message: string | null } {
  if (json && typeof json === "object" && "error" in json) {
    const error = (json as { error?: unknown }).error;
    if (error && typeof error === "object") {
      const code = "code" in error && typeof error.code === "string" ? error.code : null;
      const message = "message" in error && typeof error.message === "string" ? error.message : null;
      return { code, message };
    }
  }
  return { code: null, message: null };
}

function authHeaders(): Record<string, string> {
  return {
    "X-API-Secret": API_SECRET ?? "",
    "X-Contractor-Token": CONTRACTOR_TOKEN ?? "",
  };
}

async function apiFetch<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const { code, message } = extractError(json);
    throw new ApiRequestError(message ?? `API request to ${path} failed: ${res.status} ${res.statusText}`, res.status, code, json);
  }

  return schema.parse(json);
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch("/health", HealthResponseSchema);
}

export async function createDesign(request: DesignCreateRequest): Promise<DesignCreateResponse> {
  DesignCreateRequestSchema.parse(request);
  return apiFetch("/design/create", DesignCreateResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function modifyDesign(request: DesignModifyRequest): Promise<DesignModifyResponse> {
  DesignModifyRequestSchema.parse(request);
  return apiFetch("/design/modify", DesignModifyResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function lookupDesign(request: DesignLookupRequest): Promise<DesignLookupResponse> {
  DesignLookupRequestSchema.parse(request);
  const query = new URLSearchParams({
    email: request.email,
    promptNumber: request.promptNumber,
    versionNumber: String(request.versionNumber),
  });
  return apiFetch(`/design/lookup?${query.toString()}`, DesignLookupResponseSchema);
}

// Streaming variants return the raw upstream Response so a Route Handler can
// pipe response.body straight through to the browser — parsing happens
// client-side (lib/sseClient.ts) since the secret/token can't travel that far.
export async function streamDesignCreate(request: DesignCreateRequest): Promise<Response> {
  DesignCreateRequestSchema.parse(request);
  return fetch(`${API_URL}/design/create/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(request),
  });
}

export async function streamDesignModify(request: DesignModifyRequest): Promise<Response> {
  DesignModifyRequestSchema.parse(request);
  return fetch(`${API_URL}/design/modify/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(request),
  });
}
