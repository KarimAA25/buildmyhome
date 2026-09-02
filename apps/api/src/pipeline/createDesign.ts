import type { DesignCreateRequest, DesignCreateResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { generateValidatedImage } from "../services/imageGeneration/generateValidatedImage";
import { refineDetectedItems } from "./refineDetectedItems";
import { env } from "../config/env";

const CANDIDATE_TOP_K = 6;

export async function createDesign(
  request: DesignCreateRequest,
  onProgress?: (state: ProgressState) => void
): Promise<DesignCreateResponse> {
  onProgress?.("ANALYZING");
  const roomAnalysis = await services.vision.analyzeRoom(request.originalImage);

  onProgress?.("SEARCHING_PRODUCTS");
  const catalog = await services.catalog.getAll();
  const queryEmbedding = await services.embedding.embed(`${roomAnalysis.roomType} ${request.userPrompt}`);
  const candidateProducts = await services.productSearch.search(queryEmbedding, catalog, CANDIDATE_TOP_K);

  onProgress?.("CREATING_DESIGN");
  const designSpecification = await services.designGeneration.generate({
    roomAnalysis,
    userPrompt: request.userPrompt,
    candidateProducts,
  });

  const { image } = await generateValidatedImage(
    services.imageGeneration,
    services.imageValidation,
    request.originalImage,
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
  const detectedItems = await services.imageDiff.detectItems(request.originalImage, image, catalog);
  const refinedItems = await refineDetectedItems(detectedItems, catalog, services.embedding);
  const groundedSpecification = { ...designSpecification, items: refinedItems };

  onProgress?.("CALCULATING_QUOTE");
  const quote = services.quotation.calculate(groundedSpecification, catalog);

  onProgress?.("COMPLETED");

  return {
    designSpecification: groundedSpecification,
    generatedImage: image,
    quote,
    version: 1,
  };
}
