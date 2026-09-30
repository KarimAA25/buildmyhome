import { AstraNotConfiguredError } from "../../pipeline/errors";
import type { AstraRealtimeService, EphemeralRealtimeSession } from "./AstraRealtimeService";

// Unlike the other stub providers in this codebase (which echo input back so
// the rest of the pipeline can be exercised offline), a fake token can't do
// a real WebRTC handshake against OpenAI — so this is honest about being
// unusable rather than pretending to work. Mapped to 503 by mapPipelineError.
export class StubAstraRealtimeProvider implements AstraRealtimeService {
  async mintEphemeralToken(): Promise<EphemeralRealtimeSession> {
    throw new AstraNotConfiguredError(
      "Astra realtime voice is not configured — OPENAI_API_KEY and OPENAI_REALTIME_MODEL must both be set."
    );
  }
}
