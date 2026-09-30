import { randomUUID } from "node:crypto";
import type { DesignSpecification } from "@buildmyhome/shared";
import type { SubmitEditResult, TaskStatusResult, VideoGenerationService } from "./VideoGenerationService";

// Mirrors StubImageGenerationProvider's pass-through: no real Runway call,
// immediately "succeeds" with the source video echoed back. Lets the full
// async pipeline (submit -> poll -> download -> Supabase upload -> status
// flip) be exercised locally with zero Runway credits spent.
export class StubVideoGenerationProvider implements VideoGenerationService {
  private tasks = new Map<string, string>();

  async submitEdit(
    sourceVideoUrl: string,
    _designSpecification: DesignSpecification,
    _userInstruction: string
  ): Promise<SubmitEditResult> {
    const taskId = randomUUID();
    this.tasks.set(taskId, sourceVideoUrl);
    return { taskId };
  }

  async getTaskStatus(taskId: string): Promise<TaskStatusResult> {
    const videoUrl = this.tasks.get(taskId);
    if (!videoUrl) {
      return { status: "FAILED", error: "StubVideoGenerationProvider: unknown taskId" };
    }
    return { status: "SUCCEEDED", videoUrl };
  }
}
