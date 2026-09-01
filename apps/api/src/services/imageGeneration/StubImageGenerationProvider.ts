import type { DesignSpecification } from "@buildmyhome/shared";
import type { ImageGenerationService } from "./ImageGenerationService";

export class StubImageGenerationProvider implements ImageGenerationService {
  async generate(baseImage: string, _designSpecification: DesignSpecification): Promise<string> {
    return baseImage;
  }
}
