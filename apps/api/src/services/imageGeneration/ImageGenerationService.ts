import type { DesignSpecification } from "@buildmyhome/shared";

export interface ImageGenerationService {
  generate(baseImage: string, designSpecification: DesignSpecification, userInstruction: string): Promise<string>;
}
