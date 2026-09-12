import type { DesignModifyRequest, DesignModifyResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { generateValidatedImage } from "../services/imageGeneration/generateValidatedImage";
import { refineDetectedItems } from "./refineDetectedItems";
import { collectSourceUrls } from "./collectSourceUrls";
import { canCreateAnotherVersion } from "./versionLimit";
import { DesignNotFoundError, VersionLimitReachedError } from "./errors";
import { env } from "../config/env";

export async function modifyDesign(
  contractorId: string,
  contractorEmail: string,
  request: DesignModifyRequest,
  onProgress?: (state: ProgressState) => void
): Promise<DesignModifyResponse> {
  const design = await services.persistence.getDesign(request.designId);
  // A design must never resolve across contractor boundaries (CLAUDE2 §10
  // rule 6) — from Contractor B's frontend, Contractor A's design simply
  // doesn't exist.
  if (!design || design.contractorId !== contractorId) {
    throw new DesignNotFoundError();
  }

  const currentVersion = await services.persistence.getLatestVersion(design.id);
  if (!currentVersion) {
    throw new DesignNotFoundError();
  }

  const versionCount = await services.persistence.getVersionCount(design.id);
  if (!canCreateAnotherVersion(design, versionCount)) {
    throw new VersionLimitReachedError(design.maxVersions ?? env.MAX_VERSIONS_PER_DESIGN, versionCount);
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

  // OpenAI's image-edit call needs real bytes, not a signed URL.
  const currentImage = await services.storage.retrieveAsBase64(currentVersion.generatedImagePath);

  const { image } = await generateValidatedImage(
    services.imageGeneration,
    services.imageValidation,
    currentImage,
    designSpecification,
    request.changeRequest,
    env.MAX_IMAGE_GENERATION_RETRIES,
    onProgress
  );

  // Quote is priced from what's actually visible in the newly generated
  // image (compared against the previous version's image), not the text
  // design spec — see createDesign.ts for the same reasoning.
  onProgress?.("REVIEWING_RESULT");
  const detectedItems = await services.imageDiff.detectItems(currentImage, image, candidateProducts);
  const refinedItems = await refineDetectedItems(detectedItems, candidateProducts, services.embedding);
  const groundedSpecification = { ...designSpecification, items: refinedItems };

  onProgress?.("CALCULATING_QUOTE");
  const quote = services.quotation.calculate(groundedSpecification, candidateProducts);
  const sourceUrls = collectSourceUrls(groundedSpecification, candidateProducts);

  const nextVersionNumber = currentVersion.versionNumber + 1;
  const generatedImageRef = await services.storage.store(image, contractorId, design.id, {
    version: nextVersionNumber,
  });

  const version = await services.persistence.createVersion({
    designId: design.id,
    versionNumber: nextVersionNumber,
    parentVersionId: currentVersion.id,
    generatedImagePath: generatedImageRef.path,
    designSpecification: groundedSpecification,
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
    quote: version.quote,
  });

  return {
    versionNumber: version.versionNumber,
    designSpecification: version.designSpecification,
    generatedImage: generatedImageRef.signedUrl,
    quote: version.quote,
    sourceUrls: version.sourceUrls,
  };
}
