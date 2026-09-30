import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ffmpeg } from "./ffmpegSetup";

export interface VideoProbeResult {
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  videoCodec: string;
  // ffprobe's format_name is a comma-separated list of matching container
  // formats (e.g. "mov,mp4,m4a,3gp,3g2,mj2") rather than a single name.
  containerFormats: string[];
  fileSizeBytes: number;
}

function parseFrameRate(rFrameRate: string | undefined): number {
  if (!rFrameRate) return 0;
  const [num, den] = rFrameRate.split("/").map(Number);
  if (!den) return num || 0;
  return num / den;
}

// fluent-ffmpeg's ffprobe/screenshots only work reliably against files, not
// buffers or streams (see its README caveats) — so every video-probing
// operation in this module writes the incoming buffer to a temp file first.
export async function withTempVideoFile<T>(buffer: Buffer, extension: string, fn: (filePath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "buildmyhome-video-"));
  const filePath = path.join(dir, `${randomUUID()}.${extension}`);
  try {
    await writeFile(filePath, buffer);
    return await fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function probeVideo(buffer: Buffer, mimeType: string): Promise<VideoProbeResult> {
  const extension = mimeType.split("/")[1]?.replace("quicktime", "mov") ?? "mp4";

  return withTempVideoFile(buffer, extension, (filePath) => {
    return new Promise<VideoProbeResult>((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) {
          reject(new Error(`probeVideo: ffprobe failed: ${err instanceof Error ? err.message : String(err)}`));
          return;
        }

        const videoStream = data.streams.find((s) => s.codec_type === "video");
        if (!videoStream) {
          reject(new Error("probeVideo: no video stream found in the uploaded file"));
          return;
        }

        resolve({
          durationSeconds: data.format.duration ?? 0,
          fps: parseFrameRate(videoStream.avg_frame_rate ?? videoStream.r_frame_rate),
          width: videoStream.width ?? 0,
          height: videoStream.height ?? 0,
          videoCodec: videoStream.codec_name ?? "unknown",
          containerFormats: (data.format.format_name ?? "").split(",").filter(Boolean),
          fileSizeBytes: data.format.size ?? buffer.byteLength,
        });
      });
    });
  });
}
