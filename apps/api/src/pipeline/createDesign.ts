import { randomUUID } from "node:crypto";
import type { DesignCreateRequest, DesignCreateResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { generateValidatedImage } from "../services/imageGeneration/generateValidatedImage";
import { refineDetectedItems } from "./refineDetectedItems";
import { collectSourceUrls } from "./collectSourceUrls";
import { fillEstimatedPrices } from "./fillEstimatedPrices";
import { env } from "../config/env";
import { createVideoDesign } from "./createVideoDesign";

export async function createDesign(
  contractorId: string,
  contractorEmail: string,
  request: DesignCreateRequest,
  onProgress?: (state: ProgressState) => void
): Promise<DesignCreateResponse> {
  if (request.mediaType === "video") {
    return createVideoDesign(contractorId, contractorEmail, request, onProgress);
  }
  // Guaranteed present by DesignCreateRequestSchema's superRefine when
  // mediaType is 'image' — asserted here as defense-in-depth and to narrow
  // the type from string | undefined for the rest of this function.
  if (!request.originalImage) {
    throw new Error("createDesign: request.originalImage is required when mediaType is 'image'");
  }
  const originalImage = request.originalImage;

  // Generated up front so the original image can be uploaded to
  // {contractorId}/{designId}/original.jpg before the designs row exists.
  const designId = randomUUID();

  onProgress?.("ANALYZING");
  const roomAnalysis = await services.vision.analyzeRoom(originalImage);

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

  const { image } = await generateValidatedImage(
    services.imageGeneration,
    services.imageValidation,
    originalImage,
    designSpecification,
    request.userPrompt,
    env.MAX_IMAGE_GENERATION_RETRIES,
    onProgress
  );

  // The quote is priced from what's actually visible in the generated image,
  // not from the text design spec above — an image-generation model doesn't
  // perfectly follow instructions, so the spec's item list can drift from
  // what the customer would actually see and be quoted for.
  onProgress?.("REVIEWING_RESULT");
  const detectedItems = await services.imageDiff.detectItems(originalImage, image, candidateProducts);
  const refinedItems = await refineDetectedItems(detectedItems, candidateProducts, services.embedding);
  const groundedSpecification = { ...designSpecification, items: refinedItems };

  onProgress?.("CALCULATING_QUOTE");
  const deterministicQuote = services.quotation.calculate(groundedSpecification, candidateProducts);
  const quote = await fillEstimatedPrices(deterministicQuote, services.priceEstimation, {
    roomType: roomAnalysis.roomType,
  });
  const sourceUrls = collectSourceUrls(groundedSpecification, candidateProducts);

  const [originalImageRef, generatedImageRef] = await Promise.all([
    services.storage.store(originalImage, contractorId, designId, "original"),
    services.storage.store(image, contractorId, designId, { version: 1 }),
  ]);

  const design = await services.persistence.createDesign({
    id: designId,
    contractorId,
    endUserEmail: request.endUserEmail,
    promptNumber: request.promptNumber,
    originalImagePath: originalImageRef.path,
    mediaType: "image",
  });

  const version = await services.persistence.createVersion({
    designId: design.id,
    versionNumber: 1,
    parentVersionId: null,
    generatedImagePath: generatedImageRef.path,
    designSpecification: groundedSpecification,
    userInstruction: request.userPrompt,
    sourceUrls,
    aiModel: env.REASONING_MODEL || null,
    quote,
  });

  onProgress?.("COMPLETED");

  // Best-effort, never awaited into the response path — CLAUDE2 §4d/§10
  // rule 11: an email failure must never fail or delay this request.
  void services.email.sendGenerationNotifications({
    contractorEmail,
    endUserEmail: design.endUserEmail,
    promptNumber: design.promptNumber,
    versionNumber: version.versionNumber,
    quote,
  });

  return {
    designId: design.id,
    // May differ from request.promptNumber if a collision forced a fresh
    // one (CLAUDE2 §2b) — the frontend must detect and display this.
    promptNumber: design.promptNumber,
    versionNumber: 1,
    mediaType: "image",
    generationStatus: "COMPLETED",
    designSpecification: version.designSpecification,
    generatedImage: generatedImageRef.signedUrl,
    quote,
    sourceUrls: version.sourceUrls,
  };
}
