import { formatQuoteEmail } from "./formatQuoteEmail";
import type { EmailNotificationInput, EmailService } from "./EmailService";

// Falls back to this when GMAIL_SENDER_ADDRESS/GMAIL_APP_PASSWORD aren't
// configured, matching the hasReasoningConfig-style gating used for the
// other AI/external providers.
export class ConsoleLoggingEmailProvider implements EmailService {
  async sendGenerationNotifications(input: EmailNotificationInput): Promise<void> {
    console.log(
      `[ConsoleLoggingEmailProvider] would notify contractor + ${input.endUserEmail} ` +
        `(prompt ${input.promptNumber}, v${input.versionNumber}):\n${formatQuoteEmail(input.quote)}`
    );
  }
}
