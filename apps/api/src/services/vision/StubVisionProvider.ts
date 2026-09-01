import type { RoomAnalysis, VisionService } from "./VisionService";

export class StubVisionProvider implements VisionService {
  async analyzeRoom(_image: string): Promise<RoomAnalysis> {
    return {
      roomType: "unknown",
      dimensions: null,
      existingFeatures: [],
      lightingNotes: "Stub provider — no real vision analysis performed.",
    };
  }
}
