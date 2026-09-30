import type { DesignModifyRequest, DesignModifyResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { env } from "../config/env";
import type { PersistedDesign, PersistedVersion } from "../services/persistence/PersistenceService";
import { collectSourceUrls } from "./collectSourceUrls";
import { fillEstimatedPrices } from "./fillEstimatedPrices";
import { PreviousVersionNotReadyError } from "./errors";
import { generateVideoInBackground } from "./generateVideoInBackground";

export async function modifyVideoDesign(
  contractorId: string,
  contractorEmail: string,
  request: DesignModifyRequest,
  design: PersistedDesign,
  currentVersion: PersistedVersion,
  versionCount: number,
  onProgress?: (state: ProgressState) => void
): Promise<DesignModifyResponse> {
  void versionCount; // already checked by canCreateAnotherVersion in modifyDesign.ts before this is called

  // A modify call can't hand Runway a source video that doesn't exist yet
  // or isn't finished rendering (CLAUDE3 §9 rule 4).
  if (currentVersion.generationStatus !== "COMPLETED" || !currentVersion.generatedVideoPath) {
    throw new PreviousVersionNotReadyError();
  }
  const previousDurationSeconds = currentVersion.videoDurationSeconds;
  if (previousDurationSeconds == null) {
    throw new Error("modifyVideoDesign: previous version is COMPLETED but has no videoDurationSeconds");
  }

  onProgress?.("SEARCHING_PRODUCTS");
  const candidateProducts = await services.productSourcing.getCandidateProducts(contractorId, {
    roomType: currentVersion.designSpecification.roomType,
    requestText: request.changeRequest,
  });

  onProgress?.("CREATING_DESIGN");
  const designSpecification = await services.designGeneration.modify({
    currentDesignSpecification: currentVersion.designSpecification,
    changeRequest: request.changeRequest,
    candidateProducts,
  });
  // Same divergence as createVideoDesign.ts: priced off the raw spec, no
  // image-diff grounding, since the render isn't done yet.

  onProgress?.("CALCULATING_QUOTE");
  const deterministicQuote = services.quotation.calculate(designSpecification, candidateProducts);
  const quote = await fillEstimatedPrices(deterministicQuote, services.priceEstimation, {
    roomType: currentVersion.designSpecification.roomType,
  });
  const sourceUrls = collectSourceUrls(designSpecification, candidateProducts);

  const nextVersionNumber = currentVersion.versionNumber + 1;

  const version = await services.persistence.createVersion({
    designId: design.id,
    versionNumber: nextVersionNumber,
    parentVersionId: currentVersion.id,
    generatedImagePath: null,
    generationStatus: "PROCESSING",
    designSpecification,
    userInstruction: request.changeRequest,
    sourceUrls,
    aiModel: env.REASONING_MODEL || null,
    quote,
  });

  onProgress?.("COMPLETED");

  void services.email.sendGenerationNotifications({
    contractorEmail,
    endUserEmail: design.endUserEmail,
    promptNumber: design.promptNumber,
    versionNumber: version.versionNumber,
    quote,
  });

  // The previous version's rendered video is the source — never the
  // original upload, never a fresh from-scratch generation (CLAUDE3 §9 rule 4).
  const sourceVideoSignedUrl = await services.storage.getSignedUrl(currentVersion.generatedVideoPath, "video");
  void generateVideoInBackground({
    versionId: version.id,
    contractorId,
    designId: design.id,
    versionNumber: nextVersionNumber,
    sourceVideoSignedUrl,
    designSpecification,
    userInstruction: request.changeRequest,
    durationSeconds: previousDurationSeconds,
  });

  return {
    versionNumber: version.versionNumber,
    mediaType: "video",
    generationStatus: "PROCESSING",
    designSpecification: version.designSpecification,
    quote,
    sourceUrls: version.sourceUrls,
  };
}
