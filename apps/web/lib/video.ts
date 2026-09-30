export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read video file"));
    reader.readAsDataURL(blob);
  });
}

// Cheap client-side pre-check only, purely for fast UX feedback — the
// server's ffprobe-based validateVideoInput is the authoritative gate and
// re-checks this independently (never trust the client alone).
export function getVideoDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata"));
    };
  });
}

// Preference order: prefer widely-supported vp8/vp9 webm, fall back to
// whatever the browser (e.g. Safari) actually supports for MediaRecorder.
const CANDIDATE_RECORDING_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

export function pickSupportedRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}
