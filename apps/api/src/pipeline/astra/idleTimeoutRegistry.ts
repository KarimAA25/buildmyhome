import { env } from "../../config/env";
import { finishAstraSession } from "./finishAstraSession";

// In-process registry, not a job queue — matches the "long-running Node
// process, no queue" philosophy already accepted for Stage 3's detached
// video-render job. Lost entirely on server restart: a session mid-conversation
// when the process restarts never auto-finishes on its own. Accepted
// limitation, not engineered around (no Redis/cron), same as
// generateVideoInBackground.ts's equivalent gap.
//
// Note: this creates a circular import with finishAstraSession.ts (which
// calls clearIdleTimeout). Safe here because `finishAstraSession` is only
// referenced inside the setTimeout callback below, never at module-load
// time — by the time the callback fires, both modules have finished
// initializing.
const timers = new Map<string, NodeJS.Timeout>();

export function armIdleTimeout(designId: string, contractorId: string, contractorEmail: string): void {
  clearIdleTimeout(designId);

  const timer = setTimeout(() => {
    timers.delete(designId);
    void finishAstraSession(contractorId, contractorEmail, { designId }).catch((err) => {
      console.error(`[astraIdleTimeout] auto-finish failed for design ${designId}:`, err);
    });
  }, env.ASTRA_SESSION_IDLE_TIMEOUT_SECONDS * 1000);

  // Never keeps the process alive on its own — a clean shutdown isn't
  // blocked by an armed idle timer.
  timer.unref();
  timers.set(designId, timer);
}

export function clearIdleTimeout(designId: string): void {
  const existing = timers.get(designId);
  if (existing) clearTimeout(existing);
  timers.delete(designId);
}
