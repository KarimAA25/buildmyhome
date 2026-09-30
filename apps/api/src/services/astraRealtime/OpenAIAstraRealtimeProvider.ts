import { env } from "../../config/env";
import type { AstraRealtimeService, EphemeralRealtimeSession } from "./AstraRealtimeService";

// Fixed, independent of ASTRA_SESSION_IDLE_TIMEOUT_SECONDS — the token's job
// (letting the browser establish/hold the WebRTC connection) and the idle-
// finish clock's job (deciding when to bill/email) are different concerns.
// No token-refresh flow in v1: a single session longer than this would need
// to re-mint — documented limitation, same "accepted limitation" philosophy
// as Stage 3's detached-video-job server-restart gap.
const CLIENT_SECRET_TTL_SECONDS = 3600;

const PROPOSE_EDIT_TOOL = {
  type: "function" as const,
  name: "propose_edit",
  description:
    "Call this whenever the user describes a change they want made to the room photo. Do not attempt to describe or perform the edit yourself — this tool hands it off to the image-editing system.",
  parameters: {
    type: "object" as const,
    properties: {
      description: {
        type: "string" as const,
        description: "The user's requested change, in their own words (e.g. 'make the walls a darker beige', 'add a small plant on the table').",
      },
    },
    required: ["description"],
  },
};

const ASTRA_VOICE_INSTRUCTIONS = `You are a friendly voice assistant helping someone redesign a room in a photo. You handle the conversation only — you never edit the image yourself. Whenever the user describes a change they want (a color, a piece of furniture, a material, moving something, anything visual), call the propose_edit function with their request. Wait for the function result before confirming anything was changed, then briefly acknowledge it in your own words. If the user is just chatting or asking a question unrelated to a visual change, respond normally without calling the function.`;

// Calls the client-secrets endpoint directly via fetch, not the `openai`
// npm SDK — this mints a client-usable ephemeral secret for the browser,
// not a server-side chat/completions call the SDK is built around.
export class OpenAIAstraRealtimeProvider implements AstraRealtimeService {
  async mintEphemeralToken(): Promise<EphemeralRealtimeSession> {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: CLIENT_SECRET_TTL_SECONDS },
        session: {
          type: "realtime",
          model: env.OPENAI_REALTIME_MODEL,
          audio: { output: { voice: "marin" } },
          instructions: ASTRA_VOICE_INSTRUCTIONS,
          tools: [PROPOSE_EDIT_TOOL],
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAIAstraRealtimeProvider: failed to mint ephemeral token (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { value: string; expires_at: number };
    return { token: data.value, expiresAt: data.expires_at };
  }
}
