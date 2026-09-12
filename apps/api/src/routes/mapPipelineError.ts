import { DesignNotFoundError, VersionLimitReachedError } from "../pipeline/errors";

export function mapPipelineError(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof DesignNotFoundError) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: "Design not found." } } };
  }
  if (err instanceof VersionLimitReachedError) {
    return {
      status: 403,
      body: {
        error: {
          code: "VERSION_LIMIT_REACHED",
          message: "You've reached the maximum number of versions for this design.",
          maxVersions: err.maxVersions,
          currentVersionCount: err.currentVersionCount,
        },
      },
    };
  }
  return { status: 502, body: { error: { code: "GENERATION_FAILED", message: "Failed to generate design." } } };
}
