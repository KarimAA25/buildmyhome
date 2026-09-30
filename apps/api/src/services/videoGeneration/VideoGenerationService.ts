import type { DesignSpecification } from "@buildmyhome/shared";

export interface SubmitEditResult {
  taskId: string;
}

export interface TaskStatusResult {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  // Only set when status is SUCCEEDED. Ephemeral — Runway's output URLs
  // expire in 24-48h, must be downloaded and persisted immediately.
  videoUrl?: string;
  // Only set when status is FAILED.
  error?: string;
}

// Submit+poll, not a single blocking call like ImageGenerationService.generate() —
// Runway's video_to_video endpoint is an async job (submit, then GET /v1/tasks/:id
// until SUCCEEDED/FAILED), which a synchronous generate(): Promise<string> can't represent.
export interface VideoGenerationService {
  submitEdit(
    sourceVideoUrl: string,
    designSpecification: DesignSpecification,
    userInstruction: string
  ): Promise<SubmitEditResult>;
  getTaskStatus(taskId: string): Promise<TaskStatusResult>;
}
