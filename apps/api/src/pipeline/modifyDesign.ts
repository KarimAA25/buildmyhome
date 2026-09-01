import type { DesignModifyRequest, DesignModifyResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { generateValidatedImage } from "../services/imageGeneration/generateValidatedImage";
import { env } from "../config/env";

const CANDIDATE_TOP_K = 6;

export async function modifyDesign(
  request: DesignModifyRequest,
  onProgress?: (state: ProgressState) => void
): Promise<DesignModifyResponse> {
  onProgress?.("SEARCHING_PRODUCTS");
  const catalog = await services.catalog.getAll();
  const queryEmbedding = await services.embedding.embed(
    `${request.currentDesignSpecification.roomType} ${request.changeRequest}`
  );
  const searchResults = await services.productSearch.search(queryEmbedding, catalog, CANDIDATE_TOP_K);

  // Carry forward products already referenced in the current spec so a change
  // request scoped to one item can't accidentally un-price an untouched one —
  // the search above is scoped to the change request text and won't reliably
  // resurface everything already in the design.
  const existingProductIds = new Set(
    request.currentDesignSpecification.items
      .map((item) => item.catalogProductId)
      .filter((id): id is string => id !== null)
  );
  const carriedForward = catalog.filter((product) => existingProductIds.has(product.id));
  const candidateProducts = [
    ...carriedForward,
    ...searchResults.filter((product) => !existingProductIds.has(product.id)),
  ];

  onProgress?.("CREATING_DESIGN");
  const designSpecification = await services.designGeneration.modify({
    currentDesignSpecification: request.currentDesignSpecification,
    changeRequest: request.changeRequest,
    candidateProducts,
  });

  onProgress?.("CALCULATING_QUOTE");
  const quote = services.quotation.calculate(designSpecification, catalog);

  const { image } = await generateValidatedImage(
    services.imageGeneration,
    services.imageValidation,
    request.currentImage,
    designSpecification,
    env.MAX_IMAGE_GENERATION_RETRIES,
    onProgress
  );

  onProgress?.("COMPLETED");

  return {
    designSpecification,
    generatedImage: image,
    quote,
    version: request.versionNumber + 1,
  };
}
