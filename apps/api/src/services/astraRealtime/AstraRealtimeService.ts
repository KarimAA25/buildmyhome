export interface EphemeralRealtimeSession {
  token: string;
  expiresAt: number;
}

// Mints a short-lived OpenAI Realtime client secret server-side so the
// browser can connect directly to OpenAI for the voice layer without ever
// seeing OPENAI_API_KEY (CLAUDE3.5.md §6). The token's lifetime is a
// separate concern from ASTRA_SESSION_IDLE_TIMEOUT_SECONDS (see the real
// provider) — this only governs how long the browser can establish/re-
// establish the WebRTC connection, not how long the app-level session lasts.
export interface AstraRealtimeService {
  mintEphemeralToken(): Promise<EphemeralRealtimeSession>;
}
