import { env } from "../../config/env";
import { InvalidVideoInputError } from "./InvalidVideoInputError";
import type { VideoProbeResult } from "./probeVideo";

// Conservative starting whitelist — not independently re-confirmed against
// Runway's live docs beyond the env-var numbers (duration/fps/resolution
// were). Loosen if real uploads get rejected that shouldn't be.
const ACCEPTED_CONTAINER_FORMATS = ["mov", "mp4", "m4a", "3gp", "3g2", "mj2", "matroska", "webm"];
const ACCEPTED_VIDEO_CODECS = ["h264", "hevc", "vp8", "vp9"];

function parseResolutionCap(resolution: string): { shortEdge: number; longEdge: number } {
  const match = resolution.match(/^(\d+)p$/i);
  const shortEdge = match ? Number(match[1]) : 1080;
  // Standard 16:9 long edge for the given short edge (e.g. 1080p -> 1920).
  return { shortEdge, longEdge: Math.round((shortEdge * 16) / 9) };
}

// Rejects out-of-range input — does NOT clamp/trim/re-encode. CLAUDE3.md §6's
// word "clamped" is superseded by Karim's direct confirmation: "Input video
// is from 2s to 5s" means validate-and-reject, not silently modify the clip.
export function validateVideoInput(probe: VideoProbeResult): void {
  if (probe.durationSeconds < env.MIN_VIDEO_DURATION_SECONDS || probe.durationSeconds > env.MAX_VIDEO_DURATION_SECONDS) {
    throw new InvalidVideoInputError(
      `Video must be between ${env.MIN_VIDEO_DURATION_SECONDS} and ${env.MAX_VIDEO_DURATION_SECONDS} seconds (got ${probe.durationSeconds.toFixed(1)}s)`
    );
  }

  if (probe.fps > env.MAX_VIDEO_FPS) {
    throw new InvalidVideoInputError(`Video frame rate must not exceed ${env.MAX_VIDEO_FPS}fps (got ${probe.fps.toFixed(1)}fps)`);
  }

  const { shortEdge, longEdge } = parseResolutionCap(env.MAX_VIDEO_RESOLUTION);
  const videoShortEdge = Math.min(probe.width, probe.height);
  const videoLongEdge = Math.max(probe.width, probe.height);
  if (videoShortEdge > shortEdge || videoLongEdge > longEdge) {
    throw new InvalidVideoInputError(
      `Video resolution must not exceed ${env.MAX_VIDEO_RESOLUTION} (got ${probe.width}x${probe.height})`
    );
  }

  if (probe.fileSizeBytes > env.MAX_VIDEO_UPLOAD_BYTES) {
    throw new InvalidVideoInputError(
      `Video file size must not exceed ${(env.MAX_VIDEO_UPLOAD_BYTES / 1_048_576).toFixed(1)}MB`
    );
  }

  if (!probe.containerFormats.some((f) => ACCEPTED_CONTAINER_FORMATS.includes(f))) {
    throw new InvalidVideoInputError(`Unsupported video container: ${probe.containerFormats.join(", ") || "unknown"}`);
  }

  if (!ACCEPTED_VIDEO_CODECS.includes(probe.videoCodec)) {
    throw new InvalidVideoInputError(`Unsupported video codec: ${probe.videoCodec}`);
  }
}
