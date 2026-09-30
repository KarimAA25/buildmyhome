import { randomUUID } from "node:crypto";
import type { DesignCreateRequest, DesignCreateResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { env } from "../config/env";
import { parseDataUrl } from "../lib/dataUrl";
import { probeVideo } from "../services/videoGeneration/probeVideo";
import { validateVideoInput } from "../services/videoGeneration/validateVideoInput";
import { extractVideoFrame } from "../services/videoGeneration/extractVideoFrame";
import { collectSourceUrls } from "./collectSourceUrls";
import { fillEstimatedPrices } from "./fillEstimatedPrices";
import { generateVideoInBackground } from "./generateVideoInBackground";

export async function createVideoDesign(
  contractorId: string,
  contractorEmail: string,
  request: DesignCreateRequest,
  onProgress?: (state: ProgressState) => void
): Promise<DesignCreateResponse> {
  // Guaranteed present by DesignCreateRequestSchema's superRefine (enforced
  // at the route's zod parse, before this function ever runs) — asserted
  // here as defense-in-depth, not because it's expected to fail.
  if (!request.originalVideo) {
    throw new Error("createVideoDesign: request.originalVideo is required when mediaType is 'video'");
  }

  const designId = randomUUID();

  const { mimeType, buffer } = parseDataUrl(request.originalVideo);
  const probe = await probeVideo(buffer, mimeType);
  // Reject fast, before any AI/Runway spend — not clamp/trim (Karim's
  // explicit correction to CLAUDE3.md §6's "clamped" wording).
  validateVideoInput(probe);

  onProgress?.("ANALYZING");
  const frame = await extractVideoFrame(buffer, mimeType, probe.durationSeconds);
  const roomAnalysis = await services.vision.analyzeRoom(frame);

  onProgress?.("SEARCHING_PRODUCTS");
  const candidateProducts = await services.productSourcing.getCandidateProducts(contractorId, {
    roomType: roomAnalysis.roomType,
    requestText: request.userPrompt,
  });

  onProgress?.("CREATING_DESIGN");
  const designSpecification = await services.designGeneration.generate({
    roomAnalysis,
    userPrompt: request.userPrompt,
    candidateProducts,
  });
  // No image-diff grounding step here (unlike the image path): the quote
  // must be ready before the render finishes (CLAUDE3 §3 step 2), so it's
  // priced directly off the raw spec rather than off pixels that don't
  // exist yet.

  onProgress?.("CALCULATING_QUOTE");
  const deterministicQuote = services.quotation.calculate(designSpecification, candidateProducts);
  const quote = await fillEstimatedPrices(deterministicQuote, services.priceEstimation, {
    roomType: roomAnalysis.roomType,
  });
  const sourceUrls = collectSourceUrls(designSpecification, candidateProducts);

  const originalVideoRef = await services.storage.store(request.originalVideo, contractorId, designId, "original");

  const design = await services.persistence.createDesign({
    id: designId,
    contractorId,
    endUserEmail: request.endUserEmail,
    promptNumber: request.promptNumber,
    originalImagePath: originalVideoRef.path,
    mediaType: "video",
  });

  const version = await services.persistence.createVersion({
    designId: design.id,
    versionNumber: 1,
    parentVersionId: null,
    generatedImagePath: null,
    generationStatus: "PROCESSING",
    designSpecification,
    userInstruction: request.userPrompt,
    sourceUrls,
    aiModel: env.REASONING_MODEL || null,
    quote,
  });

  // Marks the SYNCHRONOUS phase done — the video render itself is still
  // PROCESSING and is tracked separately via GET /design/lookup polling.
  onProgress?.("COMPLETED");

  // Fires now, independent of the render (CLAUDE3 §3 step 3 / §9 rule 7 /
  // §10 step 9) — same fire-and-forget pattern as the image pipeline.
  void services.email.sendGenerationNotifications({
    contractorEmail,
    endUserEmail: design.endUserEmail,
    promptNumber: design.promptNumber,
    versionNumber: 1,
    quote: version.quote,
  });

  const sourceVideoSignedUrl = await services.storage.getSignedUrl(originalVideoRef.path, "video");
  void generateVideoInBackground({
    versionId: version.id,
    contractorId,
    designId: design.id,
    versionNumber: 1,
    sourceVideoSignedUrl,
    designSpecification,
    userInstruction: request.userPrompt,
    durationSeconds: probe.durationSeconds,
  });

  return {
    designId: design.id,
    promptNumber: design.promptNumber,
    versionNumber: 1,
    mediaType: "video",
    generationStatus: "PROCESSING",
    designSpecification: version.designSpecification,
    quote: version.quote,
    sourceUrls: version.sourceUrls,
  };
}
