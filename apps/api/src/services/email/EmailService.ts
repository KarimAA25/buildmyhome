import type { Quote } from "@buildmyhome/shared";

export interface EmailNotificationInput {
  contractorEmail: string;
  endUserEmail: string;
  promptNumber: string;
  // Null for Astra's finish notification — no version number applies to a
  // continuous session (Stage 3.5 §4).
  versionNumber: number | null;
  quote: Quote;
}

// Contract: implementations must never throw. Every failure is best-effort —
// log and move on (CLAUDE2 §4d) — so callers can fire-and-forget without
// their own try/catch.
export interface EmailService {
  sendGenerationNotifications(input: EmailNotificationInput): Promise<void>;
}
