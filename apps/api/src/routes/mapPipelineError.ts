import {
  AstraNotConfiguredError,
  DesignNotFoundError,
  PreviousVersionNotReadyError,
  SessionAlreadyFinishedError,
  VersionLimitReachedError,
} from "../pipeline/errors";
import { InvalidVideoInputError } from "../services/videoGeneration/InvalidVideoInputError";

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
  if (err instanceof InvalidVideoInputError) {
    return { status: 400, body: { error: { code: "INVALID_VIDEO_INPUT", message: err.message } } };
  }
  if (err instanceof PreviousVersionNotReadyError) {
    return {
      status: 409,
      body: { error: { code: "PREVIOUS_VERSION_NOT_READY", message: "The previous version hasn't finished rendering yet." } },
    };
  }
  if (err instanceof SessionAlreadyFinishedError) {
    return { status: 409, body: { error: { code: "SESSION_ALREADY_FINISHED", message: err.message } } };
  }
  if (err instanceof AstraNotConfiguredError) {
    return { status: 503, body: { error: { code: "ASTRA_NOT_CONFIGURED", message: err.message } } };
  }
  return { status: 502, body: { error: { code: "GENERATION_FAILED", message: "Failed to generate design." } } };
}
