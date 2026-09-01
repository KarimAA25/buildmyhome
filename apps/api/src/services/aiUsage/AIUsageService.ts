export interface AIUsageRecord {
  service: string;
  model: string;
  tokensOrUnits: number;
  timestamp: string;
}

export interface AIUsageService {
  record(usage: AIUsageRecord): Promise<void>;
}
