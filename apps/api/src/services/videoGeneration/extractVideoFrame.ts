import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bufferToDataUrl } from "../../lib/dataUrl";
import { ffmpeg } from "./ffmpegSetup";
import { withTempVideoFile } from "./probeVideo";

// Extracts one representative frame, server-side, so the unchanged
// VisionService (which expects a still image) can run on video input without
// any change to the §7 request contract or to VisionService itself.
export async function extractVideoFrame(buffer: Buffer, mimeType: string, durationSeconds: number): Promise<string> {
  const inputExtension = mimeType.split("/")[1]?.replace("quicktime", "mov") ?? "mp4";
  // ~1s in avoids a black/transitional first frame on cut-heavy clips;
  // fall back to 0s for very short clips where 1s would be out of range.
  const timestampSeconds = durationSeconds > 1.5 ? 1 : 0;

  return withTempVideoFile(buffer, inputExtension, async (inputPath) => {
    const outputDir = path.dirname(inputPath);
    const outputFilename = `${randomUUID()}.jpg`;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .on("end", () => resolve())
        .on("error", (err: unknown) => reject(new Error(`extractVideoFrame: ffmpeg failed: ${err instanceof Error ? err.message : String(err)}`)))
        .screenshots({
          timestamps: [timestampSeconds],
          filename: outputFilename,
          folder: outputDir,
        });
    });

    const frameBuffer = await readFile(path.join(outputDir, outputFilename));
    return bufferToDataUrl(frameBuffer, "image/jpeg");
  });
}
