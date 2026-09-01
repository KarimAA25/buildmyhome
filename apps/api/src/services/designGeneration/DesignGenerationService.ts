import type { DesignSpecification } from "@buildmyhome/shared";
import type { RoomAnalysis } from "../vision/VisionService";
import type { CatalogProduct } from "../catalog/CatalogService";

export interface DesignGenerationInput {
  roomAnalysis: RoomAnalysis;
  userPrompt: string;
  candidateProducts: CatalogProduct[];
}

export interface DesignModificationInput {
  currentDesignSpecification: DesignSpecification;
  changeRequest: string;
  candidateProducts: CatalogProduct[];
}

export interface DesignGenerationService {
  generate(input: DesignGenerationInput): Promise<DesignSpecification>;
  modify(input: DesignModificationInput): Promise<DesignSpecification>;
}
