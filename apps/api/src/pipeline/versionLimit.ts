import { env } from "../config/env";
import type { PersistedDesign } from "../services/persistence/PersistenceService";

// The single, clearly-named check CLAUDE2 §2c requires — a design's own
// max_versions wins when set (the future paid-tokens hook), otherwise the
// env default applies. Never inline this comparison in a route handler.
export function canCreateAnotherVersion(design: PersistedDesign, currentVersionCount: number): boolean {
  const max = design.maxVersions ?? env.MAX_VERSIONS_PER_DESIGN;
  return currentVersionCount < max;
}
