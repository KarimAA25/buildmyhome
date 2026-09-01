import { z } from "zod";

export const RoomAnalysisSchema = z.object({
  roomType: z.string(),
  dimensions: z.string().nullable(),
  existingFeatures: z.array(z.string()),
  lightingNotes: z.string(),
});
export type RoomAnalysis = z.infer<typeof RoomAnalysisSchema>;

export interface VisionService {
  analyzeRoom(image: string): Promise<RoomAnalysis>;
}
