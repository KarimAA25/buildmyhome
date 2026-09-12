import type { Quote } from "@buildmyhome/shared";

export interface EmailNotificationInput {
  contractorEmail: string;
  endUserEmail: string;
  promptNumber: string;
  versionNumber: number;
  quote: Quote;
}

// Contract: implementations must never throw. Every failure is best-effort —
// log and move on (CLAUDE2 §4d) — so callers can fire-and-forget without
// their own try/catch.
export interface EmailService {
  sendGenerationNotifications(input: EmailNotificationInput): Promise<void>;
}
