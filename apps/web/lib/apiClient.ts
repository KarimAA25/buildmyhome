import {
  HealthResponseSchema,
  DesignCreateRequestSchema,
  DesignCreateResponseSchema,
  DesignModifyRequestSchema,
  DesignModifyResponseSchema,
  type HealthResponse,
  type DesignCreateRequest,
  type DesignCreateResponse,
  type DesignModifyRequest,
  type DesignModifyResponse,
} from "@buildmyhome/shared";

// The only module in apps/web allowed to call fetch against apps/api.
// Components and pages must go through the functions exported here —
// never call fetch or hold business logic directly.

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_SECRET = process.env.API_SHARED_SECRET;

async function apiFetch<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "X-API-Secret": API_SECRET ?? "",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API request to ${path} failed: ${res.status} ${res.statusText}`);
  }

  return schema.parse(await res.json());
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

// Streaming variants return the raw upstream Response so a Route Handler can
// pipe response.body straight through to the browser — parsing happens
// client-side (lib/sseClient.ts) since the secret can't travel that far.
export async function streamDesignCreate(request: DesignCreateRequest): Promise<Response> {
  DesignCreateRequestSchema.parse(request);
  return fetch(`${API_URL}/design/create/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Secret": API_SECRET ?? "" },
    body: JSON.stringify(request),
  });
}

export async function streamDesignModify(request: DesignModifyRequest): Promise<Response> {
  DesignModifyRequestSchema.parse(request);
  return fetch(`${API_URL}/design/modify/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Secret": API_SECRET ?? "" },
    body: JSON.stringify(request),
  });
}
