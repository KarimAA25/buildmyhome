import RunwayML from "@runwayml/sdk";
import type { DesignSpecification } from "@buildmyhome/shared";
import { env } from "../../config/env";
import { buildEditInstruction } from "./buildEditInstruction";
import type { SubmitEditResult, TaskStatusResult, VideoGenerationService } from "./VideoGenerationService";

// The SDK's video_to_video params are a discriminated union keyed by the
// literal 'aleph2' (confirmed against the shipped SDK types, matches the
// live API — see CLAUDE3.md §2). env.RUNWAY_VIDEO_MODEL is a plain string
// for config-gating purposes (container.ts's hasVideoConfig check); this
// asserts it actually is 'aleph2' before it's used as that literal, rather
// than silently casting a wrong value through.
function assertAlephModel(model: string): asserts model is "aleph2" {
  if (model !== "aleph2") {
    throw new Error(`RunwayVideoGenerationProvider: unsupported RUNWAY_VIDEO_MODEL "${model}", expected "aleph2"`);
  }
}

export class RunwayVideoGenerationProvider implements VideoGenerationService {
  private client = new RunwayML({ apiKey: env.RUNWAYML_API_SECRET });

  async submitEdit(
    sourceVideoUrl: string,
    designSpecification: DesignSpecification,
    userInstruction: string
  ): Promise<SubmitEditResult> {
    assertAlephModel(env.RUNWAY_VIDEO_MODEL);

    const task = await this.client.videoToVideo.create({
      model: env.RUNWAY_VIDEO_MODEL,
      videoUri: sourceVideoUrl,
      promptText: buildEditInstruction(designSpecification, userInstruction),
      // No duration field: aleph2 edits the supplied clip in place rather
      // than generating to a target length. Duration is purely an
      // input-validation gate (validateVideoInput), never forwarded here.
    });

    return { taskId: task.id };
  }

  async getTaskStatus(taskId: string): Promise<TaskStatusResult> {
    const task = await this.client.tasks.retrieve(taskId);

    switch (task.status) {
      case "SUCCEEDED": {
        const videoUrl = task.output[0];
        if (!videoUrl) {
          return { status: "FAILED", error: "Runway task succeeded but returned no output URL" };
        }
        return { status: "SUCCEEDED", videoUrl };
      }
      case "FAILED":
        return { status: "FAILED", error: task.failure };
      case "CANCELLED":
        return { status: "FAILED", error: "Runway task was cancelled" };
      case "PENDING":
      case "THROTTLED":
        return { status: "PENDING" };
      case "RUNNING":
        return { status: "RUNNING" };
    }
  }
}
