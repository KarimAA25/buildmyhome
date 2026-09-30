// Mirrors apps/api's MAX_PROMPT_LENGTH default for client-side UX only.
// The server enforces its own env-configured limit independently.
export const MAX_PROMPT_LENGTH_UI = 2000;

// Mirrors apps/api's MIN/MAX_VIDEO_DURATION_SECONDS defaults for client-side
// UX only (recording auto-stop, Stop-button gating, pre-upload rejection).
// The server's ffprobe-based validateVideoInput is the authoritative check.
export const MIN_VIDEO_DURATION_SECONDS_UI = 2;
export const MAX_VIDEO_DURATION_SECONDS_UI = 5;

// Deliberately below the server's 1080p ceiling: a 1080p/30fps/5s clip risks
// exceeding Vercel's ~4.5MB Function payload limit once base64-inflated when
// proxied through this app's route handlers (same constraint resizeImage.ts
// already works around for photos). 720p keeps recordings comfortably under
// that ceiling while still being ample quality for a short room preview.
export const VIDEO_RECORDING_MAX_HEIGHT = 720;
