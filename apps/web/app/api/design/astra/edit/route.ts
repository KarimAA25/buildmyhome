import { applyAstraEdit, ApiRequestError } from "@/lib/apiClient";

// A Route Handler (not a Server Action) specifically so maxDuration can be
// set here — Server Actions in this codebase have no such control. 60s is
// comfortably under the 300s ceiling used by the SSE streaming routes, since
// one edit-turn is just an orchestration call + one image-edit call, not a
// chain of retries.
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const result = await applyAstraEdit(body);
    return Response.json(result);
  } catch (err) {
    // Forward the backend's real status/error body (e.g. 409
    // SESSION_ALREADY_FINISHED) rather than letting it collapse into a
    // generic 500 — the frontend's astraRealtime.ts branches on this.
    if (err instanceof ApiRequestError) {
      return Response.json(err.body ?? { error: { code: "EDIT_FAILED", message: err.message } }, { status: err.status });
    }
    return Response.json({ error: { code: "EDIT_FAILED", message: "Something went wrong applying that change." } }, { status: 502 });
  }
}
