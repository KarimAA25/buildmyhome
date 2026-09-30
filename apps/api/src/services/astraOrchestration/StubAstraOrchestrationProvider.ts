import type {
  AstraOrchestrationInput,
  AstraOrchestrationResult,
  AstraOrchestrationService,
} from "./AstraOrchestrationService";

// Echoes the current spec unchanged with a canned instruction/acknowledgement
// — lets the rest of the edit-turn pipeline (storage, persistence, routes)
// be exercised offline, matching the other stub providers' pass-through style.
export class StubAstraOrchestrationProvider implements AstraOrchestrationService {
  async proposeEdit(input: AstraOrchestrationInput): Promise<AstraOrchestrationResult> {
    return {
      editInstruction: `[stub] Apply this change, preserve everything else: ${input.userUtterance}`,
      updatedDesignSpecification: input.currentDesignSpecification,
      modelChoice: "fast",
      acknowledgement: "Okay, done.",
    };
  }
}
