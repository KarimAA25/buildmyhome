import type { DesignSpecification } from "@buildmyhome/shared";
import { services } from "../container";
import { env } from "../config/env";

interface GenerateVideoInBackgroundParams {
  versionId: string;
  contractorId: string;
  designId: string;
  versionNumber: number;
  sourceVideoSignedUrl: string;
  designSpecification: DesignSpecification;
  userInstruction: string;
  durationSeconds: number;
}

async function pollRunwayTask(taskId: string): Promise<{ videoUrl: string }> {
  const deadline = Date.now() + env.RUNWAY_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await services.videoGeneration.getTaskStatus(taskId);

    if (status.status === "SUCCEEDED") {
      if (!status.videoUrl) throw new Error("Video generation succeeded but returned no output URL");
      return { videoUrl: status.videoUrl };
    }
    if (status.status === "FAILED") {
      throw new Error(status.error ?? "Video generation failed");
    }

    await new Promise((resolve) => setTimeout(resolve, env.RUNWAY_POLL_INTERVAL_MS));
  }

  throw new Error(`Video generation did not complete within ${env.RUNWAY_POLL_TIMEOUT_MS}ms`);
}

// Runs detached from the HTTP request/response cycle — create/modifyVideoDesign
// return PROCESSING immediately and call this unawaited (`void
// generateVideoInBackground(...)`). Only works because apps/api is a
// long-running Node process (Railway), not serverless — a serverless
// function would be killed before this resolves. Accepted limitation, not
// engineered around (CLAUDE3.md asks for no job queue): a server restart
// mid-poll leaves the version stuck in PROCESSING forever; there is no
// reaper/retry for that case.
export async function generateVideoInBackground(params: GenerateVideoInBackgroundParams): Promise<void> {
  try {
    const { taskId } = await services.videoGeneration.submitEdit(
      params.sourceVideoSignedUrl,
      params.designSpecification,
      params.userInstruction
    );
    const { videoUrl } = await pollRunwayTask(taskId);
    const stored = await services.storage.storeVideoFromUrl(videoUrl, params.contractorId, params.designId, params.versionNumber);

    await services.persistence.updateVersionStatus({
      versionId: params.versionId,
      status: "COMPLETED",
      generatedVideoPath: stored.path,
      videoDurationSeconds: params.durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown video generation failure";
    console.error(`[generateVideoInBackground] version ${params.versionId} failed:`, err);

    try {
      await services.persistence.updateVersionStatus({
        versionId: params.versionId,
        status: "FAILED",
        generationError: message,
      });
    } catch (persistErr) {
      console.error(`[generateVideoInBackground] failed to record failure for version ${params.versionId}:`, persistErr);
    }
  }
}
