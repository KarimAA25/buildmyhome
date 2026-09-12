import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { formatQuoteEmail } from "./formatQuoteEmail";
import type { EmailNotificationInput, EmailService } from "./EmailService";

// Single fixed Gmail sender account for every contractor/end-user email
// across every contractor deployment (CLAUDE2 §4c) — authenticated with a
// Gmail App Password, not the account's real login password.
export class NodemailerGmailProvider implements EmailService {
  private transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.GMAIL_SENDER_ADDRESS, pass: env.GMAIL_APP_PASSWORD },
  });

  async sendGenerationNotifications(input: EmailNotificationInput): Promise<void> {
    const quoteText = formatQuoteEmail(input.quote);
    const subject = `BuildMyHome design #${input.promptNumber} — version ${input.versionNumber}`;
    const details = `Prompt number: ${input.promptNumber}\nVersion: ${input.versionNumber}\n\n${quoteText}`;

    const send = (to: string, intro: string) =>
      this.transporter.sendMail({
        from: `"${env.EMAIL_FROM_NAME}" <${env.GMAIL_SENDER_ADDRESS}>`,
        to,
        subject,
        text: `${intro}\n\n${details}`,
      });

    // Best-effort, independently per recipient — one failing must never
    // block the other, and neither may ever throw into the caller
    // (CLAUDE2 §4d, §10 rule 11).
    const results = await Promise.allSettled([
      send(input.contractorEmail, `New design request from ${input.endUserEmail}.`),
      send(input.endUserEmail, "Here is your design quote."),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[NodemailerGmailProvider] failed to send a notification email:", result.reason);
      }
    }
  }
}
