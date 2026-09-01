import type { DesignCreateRequest, DesignCreateResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { generateValidatedImage } from "../services/imageGeneration/generateValidatedImage";
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

  onProgress?.("CALCULATING_QUOTE");
  const quote = services.quotation.calculate(designSpecification, catalog);

  const { image } = await generateValidatedImage(
    services.imageGeneration,
    services.imageValidation,
    request.originalImage,
    designSpecification,
    env.MAX_IMAGE_GENERATION_RETRIES,
    onProgress
  );

  onProgress?.("COMPLETED");

  return {
    designSpecification,
    generatedImage: image,
    quote,
    version: 1,
  };
}
