import { z } from "zod";
import { DesignSpecificationSchema, type DesignSpecification } from "@buildmyhome/shared";
import type { CatalogProduct } from "../catalog/CatalogService";

export interface AstraOrchestrationInput {
  // Base64 data URL of the current (most recently edited) image — the
  // orchestration layer receives it as context on every turn, unlike the
  // text-only DesignGenerationService (CLAUDE3.5 §1 rule 3).
  currentImage: string;
  currentDesignSpecification: DesignSpecification;
  candidateProducts: CatalogProduct[];
  userUtterance: string;
}

export const AstraOrchestrationResultSchema = z.object({
  // Ready to hand directly to the image-edit model — already phrased as a
  // preserve-everything-else instruction, not the user's raw utterance.
  editInstruction: z.string(),
  updatedDesignSpecification: DesignSpecificationSchema,
  modelChoice: z.enum(["fast", "precise"]),
  // Short natural-language confirmation for the voice model to speak.
  acknowledgement: z.string(),
});
export type AstraOrchestrationResult = z.infer<typeof AstraOrchestrationResultSchema>;

// Decides what actually needs to change and how (CLAUDE3.5 §1 rule 3's
// "Astra" role) — reasoning only, never touches pixels itself. The actual
// pixel edit happens in AstraImageEditService, driven by this result.
export interface AstraOrchestrationService {
  proposeEdit(input: AstraOrchestrationInput): Promise<AstraOrchestrationResult>;
}
