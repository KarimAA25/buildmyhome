import type { DesignSpecification } from "@buildmyhome/shared";
import type { ImageValidationResult, ImageValidationService } from "./ImageValidationService";

export class NoOpImageValidationProvider implements ImageValidationService {
  async validate(_image: string, _designSpecification: DesignSpecification): Promise<ImageValidationResult> {
    return { valid: true, reason: null };
  }
}
