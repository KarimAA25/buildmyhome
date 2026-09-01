import type { DesignSpecification } from "@buildmyhome/shared";
import type {
  DesignGenerationInput,
  DesignModificationInput,
  DesignGenerationService,
} from "./DesignGenerationService";

export class StubDesignGenerationProvider implements DesignGenerationService {
  async generate(input: DesignGenerationInput): Promise<DesignSpecification> {
    return {
      roomType: input.roomAnalysis.roomType,
      style: "unspecified",
      summary: `Stub design generated from prompt: "${input.userPrompt}"`,
      colorPalette: [],
      items: [],
      notes: "Stub provider — no real design generation performed.",
    };
  }

  async modify(input: DesignModificationInput): Promise<DesignSpecification> {
    return {
      ...input.currentDesignSpecification,
      summary: `Stub modification applied for change request: "${input.changeRequest}"`,
      notes: "Stub provider — no real design modification performed.",
    };
  }
}
