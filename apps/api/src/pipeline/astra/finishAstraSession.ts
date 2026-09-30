import type { AstraFinishRequest, AstraFinishResponse } from "@buildmyhome/shared";
import { services } from "../../container";
import { DesignNotFoundError } from "../errors";
import { collectSourceUrls } from "../collectSourceUrls";
import { fillEstimatedPrices } from "../fillEstimatedPrices";
import { clearIdleTimeout } from "./idleTimeoutRegistry";

export async function finishAstraSession(
  contractorId: string,
  contractorEmail: string,
  request: AstraFinishRequest
): Promise<AstraFinishResponse> {
  const design = await services.persistence.getDesign(request.designId);
  if (!design || design.contractorId !== contractorId || design.mediaType !== "astra") {
    throw new DesignNotFoundError();
  }

  // Idempotent — an explicit "End Session" click can race the idle-timeout
  // auto-finish; both just need to land on the same final result, not fire
  // a second quote/email.
  if (design.astraFinishedAt) {
    const latest = await services.persistence.getLatestVersion(design.id, { quoteOptional: false });
    if (!latest?.quote) {
      throw new Error("finishAstraSession: design marked finished but its latest version has no quote");
    }
    return {
      designId: design.id,
      promptNumber: design.promptNumber,
      mediaType: "astra",
      designSpecification: latest.designSpecification,
      quote: latest.quote,
      sourceUrls: latest.sourceUrls,
    };
  }

  clearIdleTimeout(design.id);

  const latestVersion = await services.persistence.getLatestVersion(design.id, { quoteOptional: true });
  if (!latestVersion) {
    throw new DesignNotFoundError();
  }
  const finalSpec = latestVersion.designSpecification;

  // Priced from the final design_specification directly — no image-diff
  // grounding, mirroring the video pipeline's approach (Stage 3.5 §4's own
  // wording: "quote is computed from the final design_specification").
  const candidateProducts = await services.productSourcing.getCandidateProducts(contractorId, {
    roomType: finalSpec.roomType,
    requestText: finalSpec.summary,
  });
  const deterministicQuote = services.quotation.calculate(finalSpec, candidateProducts);
  const quote = await fillEstimatedPrices(deterministicQuote, services.priceEstimation, { roomType: finalSpec.roomType });
  const sourceUrls = collectSourceUrls(finalSpec, candidateProducts);

  // Attaches to the EXISTING latest version rather than minting a new one —
  // keeps "latest version = the finished result" true (Stage 3.5 §3).
  await services.persistence.attachQuoteToVersion({ versionId: latestVersion.id, quote });
  await services.persistence.markAstraFinished(design.id);

  void services.email.sendGenerationNotifications({
    contractorEmail,
    endUserEmail: design.endUserEmail,
    promptNumber: design.promptNumber,
    versionNumber: null, // no version number for Astra — Stage 3.5 §4
    quote,
  });

  return {
    designId: design.id,
    promptNumber: design.promptNumber,
    mediaType: "astra",
    designSpecification: finalSpec,
    quote,
    sourceUrls,
  };
}
