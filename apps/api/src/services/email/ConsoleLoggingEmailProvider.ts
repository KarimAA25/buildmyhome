import { formatQuoteEmail } from "./formatQuoteEmail";
import type { EmailNotificationInput, EmailService } from "./EmailService";

// Falls back to this when GMAIL_SENDER_ADDRESS/GMAIL_APP_PASSWORD aren't
// configured, matching the hasReasoningConfig-style gating used for the
// other AI/external providers.
export class ConsoleLoggingEmailProvider implements EmailService {
  async sendGenerationNotifications(input: EmailNotificationInput): Promise<void> {
    const versionLabel = input.versionNumber != null ? `v${input.versionNumber}` : "no version (Astra)";
    console.log(
      `[ConsoleLoggingEmailProvider] would notify contractor + ${input.endUserEmail} ` +
        `(prompt ${input.promptNumber}, ${versionLabel}):\n${formatQuoteEmail(input.quote)}`
    );
  }
}
