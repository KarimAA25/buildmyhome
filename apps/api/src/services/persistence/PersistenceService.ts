export interface PersistenceService {
  saveDesignVersion(version: unknown): Promise<void>;
  loadDesignVersion(id: string): Promise<unknown | null>;
  listProjectHistory(projectId: string): Promise<unknown[]>;
  recordAiUsage(usage: unknown): Promise<void>;
}
