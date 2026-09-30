import type { AstraEditRequest, AstraEditResponse } from "@buildmyhome/shared";
import { services } from "../../container";
import { env } from "../../config/env";
import { DesignNotFoundError, SessionAlreadyFinishedError } from "../errors";
import { collectSourceUrls } from "../collectSourceUrls";
import { armIdleTimeout } from "./idleTimeoutRegistry";

export async function applyAstraEdit(
  contractorId: string,
  contractorEmail: string,
  request: AstraEditRequest
): Promise<AstraEditResponse> {
  const design = await services.persistence.getDesign(request.designId);
  if (!design || design.contractorId !== contractorId || design.mediaType !== "astra") {
    throw new DesignNotFoundError();
  }
  if (design.astraFinishedAt) {
    throw new SessionAlreadyFinishedError();
  }

  const currentVersion = await services.persistence.getLatestVersion(design.id, { quoteOptional: true });
  if (!currentVersion) {
    throw new DesignNotFoundError();
  }

  // Real activity resets the idle clock.
  armIdleTimeout(design.id, contractorId, contractorEmail);

  const currentImage = await services.storage.retrieveAsBase64(currentVersion.generatedImagePath, "astra");

  const candidateProducts = await services.productSourcing.getCandidateProducts(contractorId, {
    roomType: currentVersion.designSpecification.roomType,
    requestText: request.userUtterance,
  });

  const plan = await services.astraOrchestration.proposeEdit({
    currentImage,
    currentDesignSpecification: currentVersion.designSpecification,
    candidateProducts,
    userUtterance: request.userUtterance,
  });

  const newImage = await services.astraImageEdit.edit(
    currentImage,
    plan.updatedDesignSpecification,
    plan.editInstruction,
    plan.modelChoice
  );

  const nextVersionNumber = currentVersion.versionNumber + 1;
  const newImageRef = await services.storage.store(newImage, contractorId, design.id, { version: nextVersionNumber }, "astra");
  const sourceUrls = collectSourceUrls(plan.updatedDesignSpecification, candidateProducts);

  // No canCreateAnotherVersion() call — this IS the entire mechanism for
  // "no version cap" on Astra threads (Stage 3.5 §3). Each edit still gets
  // its own design_versions row, purely as an internal audit trail, never
  // exposed to the user as a "version."
  await services.persistence.createVersion({
    designId: design.id,
    versionNumber: nextVersionNumber,
    parentVersionId: currentVersion.id,
    generatedImagePath: newImageRef.path,
    designSpecification: plan.updatedDesignSpecification,
    userInstruction: request.userUtterance,
    sourceUrls,
    aiModel: env.OPENAI_ASTRA_ORCHESTRATION_MODEL || null,
    quote: null, // no quote per edit-turn — Stage 3.5 §4/§11 rule 4
  });

  return {
    designId: design.id,
    generatedImage: newImageRef.signedUrl,
    designSpecification: plan.updatedDesignSpecification,
    acknowledgement: plan.acknowledgement,
  };
}
