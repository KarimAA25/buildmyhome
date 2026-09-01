import type { PersistenceService } from "./PersistenceService";

export class NoOpPersistenceProvider implements PersistenceService {
  async saveDesignVersion(_version: unknown): Promise<void> {}

  async loadDesignVersion(_id: string): Promise<unknown | null> {
    return null;
  }

  async listProjectHistory(_projectId: string): Promise<unknown[]> {
    return [];
  }

  async recordAiUsage(_usage: unknown): Promise<void> {}
}
