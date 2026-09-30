import { randomUUID } from "node:crypto";
import type { AstraStartRequest, AstraStartResponse, DesignSpecification } from "@buildmyhome/shared";
import { services } from "../../container";
import { armIdleTimeout } from "./idleTimeoutRegistry";

export async function startAstraSession(
  contractorId: string,
  contractorEmail: string,
  request: AstraStartRequest
): Promise<AstraStartResponse> {
  const designId = randomUUID();

  const originalRef = await services.storage.store(request.originalImage, contractorId, designId, "original", "astra");

  const design = await services.persistence.createDesign({
    id: designId,
    contractorId,
    endUserEmail: request.endUserEmail,
    promptNumber: request.promptNumber,
    originalImagePath: originalRef.path,
    mediaType: "astra",
  });

  // Version 1 = the original photo with a vision-derived baseline spec, so
  // the first edit turn always has a "current version" to build from.
  const roomAnalysis = await services.vision.analyzeRoom(request.originalImage);
  const initialSpec: DesignSpecification = {
    roomType: roomAnalysis.roomType,
    style: "current",
    summary: "Original room photo, no edits yet.",
    colorPalette: [],
    items: [],
    notes: null,
  };
  await services.persistence.createVersion({
    designId: design.id,
    versionNumber: 1,
    parentVersionId: null,
    generatedImagePath: originalRef.path,
    designSpecification: initialSpec,
    userInstruction: null,
    sourceUrls: [],
    aiModel: null,
    quote: null, // no quote, no email at start — Stage 3.5 §4
  });

  const realtimeSession = await services.astraRealtime.mintEphemeralToken();
  armIdleTimeout(design.id, contractorId, contractorEmail);

  return {
    designId: design.id,
    promptNumber: design.promptNumber,
    mediaType: "astra",
    realtimeSession,
  };
}
