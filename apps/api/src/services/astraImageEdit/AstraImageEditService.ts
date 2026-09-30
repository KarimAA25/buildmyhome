import type { DesignSpecification } from "@buildmyhome/shared";

export type AstraEditModel = "fast" | "precise";

// Edits the existing image in place — never regenerates from scratch
// (CLAUDE3.5 §11 rule 1). Separate from ImageGenerationService because
// Astra's image-edit model choice is decided per-turn by the orchestration
// layer (fast vs precise), not fixed per deployment like IMAGE_MODEL.
export interface AstraImageEditService {
  edit(
    currentImage: string,
    designSpecification: DesignSpecification,
    editInstruction: string,
    model: AstraEditModel
  ): Promise<string>;
}
