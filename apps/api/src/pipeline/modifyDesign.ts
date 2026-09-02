import type { DesignModifyRequest, DesignModifyResponse, ProgressState } from "@buildmyhome/shared";
import { services } from "../container";
import { generateValidatedImage } from "../services/imageGeneration/generateValidatedImage";
import { refineDetectedItems } from "./refineDetectedItems";
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
  // resurface everything already in the design. (This still matters for
  // guiding design generation below; the final quote grounding further down
  // uses the full catalog directly, so it isn't limited by this candidate set.)
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

  const { image } = await generateValidatedImage(
    services.imageGeneration,
    services.imageValidation,
    request.currentImage,
    designSpecification,
    request.changeRequest,
    env.MAX_IMAGE_GENERATION_RETRIES,
    onProgress
  );

  // Quote is priced from what's actually visible in the newly generated
  // image (compared against the previous version's image), not the text
  // design spec — see createDesign.ts for the same reasoning.
  onProgress?.("REVIEWING_RESULT");
  const detectedItems = await services.imageDiff.detectItems(request.currentImage, image, catalog);
  const refinedItems = await refineDetectedItems(detectedItems, catalog, services.embedding);
  const groundedSpecification = { ...designSpecification, items: refinedItems };

  onProgress?.("CALCULATING_QUOTE");
  const quote = services.quotation.calculate(groundedSpecification, catalog);

  onProgress?.("COMPLETED");

  return {
    designSpecification: groundedSpecification,
    generatedImage: image,
    quote,
    version: request.versionNumber + 1,
  };
}
