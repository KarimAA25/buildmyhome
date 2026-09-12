import { randomUUID } from "node:crypto";
import type {
  CreateDesignInput,
  CreateVersionInput,
  LookupCredentials,
  PersistedDesign,
  PersistedVersion,
  PersistenceService,
} from "./PersistenceService";

// Kept for a fully offline/local demo mode (CLAUDE2.md intro) — nothing is
// actually stored, so retrieval ("Retrieve Old") can never find anything and
// every design thread is effectively single-request/in-memory only.
export class NoOpPersistenceProvider implements PersistenceService {
  async createDesign(input: CreateDesignInput): Promise<PersistedDesign> {
    return {
      id: input.id,
      contractorId: input.contractorId,
      endUserEmail: input.endUserEmail,
      promptNumber: input.promptNumber,
      originalImagePath: input.originalImagePath,
      maxVersions: null,
    };
  }

  async getDesign(_designId: string): Promise<PersistedDesign | null> {
    return null;
  }

  async getLatestVersion(_designId: string): Promise<PersistedVersion | null> {
    return null;
  }

  async getVersionCount(_designId: string): Promise<number> {
    return 0;
  }

  async createVersion(input: CreateVersionInput): Promise<PersistedVersion> {
    return {
      id: randomUUID(),
      designId: input.designId,
      versionNumber: input.versionNumber,
      parentVersionId: input.parentVersionId,
      generatedImagePath: input.generatedImagePath,
      designSpecification: input.designSpecification,
      sourceUrls: input.sourceUrls,
      quote: input.quote,
    };
  }

  async lookup(_credentials: LookupCredentials): Promise<{ design: PersistedDesign; version: PersistedVersion } | null> {
    return null;
  }
}
