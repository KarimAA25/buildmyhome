import type { AIUsageRecord, AIUsageService } from "./AIUsageService";

export class ConsoleLoggingAIUsageProvider implements AIUsageService {
  async record(usage: AIUsageRecord): Promise<void> {
    console.log("[ai-usage]", JSON.stringify(usage));
  }
}
