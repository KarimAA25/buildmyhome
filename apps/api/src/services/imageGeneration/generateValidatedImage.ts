import type { DesignSpecification, ProgressState } from "@buildmyhome/shared";
import type { ImageGenerationService } from "./ImageGenerationService";
import type { ImageValidationService } from "../imageValidation/ImageValidationService";

export interface ValidatedImageResult {
  image: string;
  valid: boolean;
  reason: string | null;
  attempts: number;
}

// Business logic kept free of request/transport concerns — the SSE progress
// stream (Phase 12) wraps this with an onProgress callback rather than this
// function knowing anything about HTTP or streaming.
export async function generateValidatedImage(
  imageGeneration: ImageGenerationService,
  imageValidation: ImageValidationService,
  baseImage: string,
  designSpecification: DesignSpecification,
  maxRetries: number,
  onProgress?: (state: ProgressState) => void
): Promise<ValidatedImageResult> {
  let lastImage: string | null = null;
  let lastReason: string | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    onProgress?.("GENERATING_IMAGE");
    const image = await imageGeneration.generate(baseImage, designSpecification);

    onProgress?.("VALIDATING");
    const result = await imageValidation.validate(image, designSpecification);

    if (result.valid) {
      return { image, valid: true, reason: null, attempts: attempt };
    }

    lastImage = image;
    lastReason = result.reason;
  }

  return { image: lastImage as string, valid: false, reason: lastReason, attempts: maxRetries + 1 };
}
