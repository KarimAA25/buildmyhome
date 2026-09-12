import type { DesignSpecification, Quote } from "@buildmyhome/shared";

export interface PersistedDesign {
  id: string;
  contractorId: string;
  endUserEmail: string;
  promptNumber: string;
  // Storage path, not a real URL — see CLAUDE2 §6 (the designs.original_image_url
  // column stores the path; a signed URL is minted from it on demand).
  originalImagePath: string;
  maxVersions: number | null;
}

export interface PersistedVersion {
  id: string;
  designId: string;
  versionNumber: number;
  parentVersionId: string | null;
  // Storage path, same caveat as PersistedDesign.originalImagePath.
  generatedImagePath: string;
  designSpecification: DesignSpecification;
  sourceUrls: string[];
  quote: Quote;
}

export interface CreateDesignInput {
  // Caller-generated (randomUUID) so the image can be uploaded to
  // {contractorId}/{designId}/original.jpg BEFORE the design row exists —
  // the row needs original_image_url populated on insert.
  id: string;
  contractorId: string;
  endUserEmail: string;
  promptNumber: string;
  originalImagePath: string;
}

export interface CreateVersionInput {
  designId: string;
  versionNumber: number;
  parentVersionId: string | null;
  generatedImagePath: string;
  designSpecification: DesignSpecification;
  userInstruction: string | null;
  sourceUrls: string[];
  aiModel: string | null;
  quote: Quote;
}

export interface LookupCredentials {
  contractorId: string;
  email: string;
  promptNumber: string;
  versionNumber: number;
}

export interface PersistenceService {
  // Handles the (contractor_id, prompt_number) collision retry internally
  // (CLAUDE2 §2b) — the returned design's promptNumber may differ from the
  // one requested; the caller (route) must detect and surface that.
  createDesign(input: CreateDesignInput): Promise<PersistedDesign>;
  getDesign(designId: string): Promise<PersistedDesign | null>;
  getLatestVersion(designId: string): Promise<PersistedVersion | null>;
  getVersionCount(designId: string): Promise<number>;
  createVersion(input: CreateVersionInput): Promise<PersistedVersion>;
  // Returns null for ANY mismatch (wrong email, wrong prompt number, wrong/
  // never-generated version) — callers must never be able to tell which
  // field was wrong (CLAUDE2 §1 rule 4).
  lookup(credentials: LookupCredentials): Promise<{ design: PersistedDesign; version: PersistedVersion } | null>;
}
