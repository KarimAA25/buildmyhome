import type { DesignSpecification } from "@buildmyhome/shared";

// The one sanctioned exception to "apiClient.ts is the sole fetch surface"
// (apps/web/lib/apiClient.ts) and to "the browser never talks to apps/api
// directly": this module calls `fetch` directly against OpenAI's Realtime
// endpoints only — never with the real OPENAI_API_KEY, only the short-lived
// ephemeral token minted server-side by POST /design/astra/start — and
// separately against the local /api/design/astra/edit Route Handler (which
// itself goes through apiClient.ts server-side, same as everything else).
// The browser is the WebRTC peer talking to OpenAI directly because a live
// voice session can't be tunneled through Vercel's Route Handler proxy
// (hard 300s maxDuration ceiling) the way every other request in this app is.

interface RealtimeFunctionCallOutput {
  [key: string]: unknown;
  type: "function_call";
  name: string;
  call_id: string;
  arguments: string;
}

interface RealtimeResponseDoneEvent {
  type: "response.done";
  response: { output: Array<Record<string, unknown>> };
}

function isFunctionCallOutput(item: Record<string, unknown>): item is RealtimeFunctionCallOutput {
  return item.type === "function_call" && typeof item.call_id === "string" && typeof item.arguments === "string";
}

export interface AstraEditTurnResult {
  designId: string;
  generatedImage: string;
  designSpecification: DesignSpecification;
  acknowledgement: string;
}

export interface ConnectAstraRealtimeOptions {
  token: string;
  designId: string;
  onImageUpdated: (result: AstraEditTurnResult) => void;
  onError: (message: string) => void;
}

export interface AstraRealtimeConnection {
  disconnect(): void;
}

export async function connectAstraRealtime({
  token,
  designId,
  onImageUpdated,
  onError,
}: ConnectAstraRealtimeOptions): Promise<AstraRealtimeConnection> {
  const pc = new RTCPeerConnection();
  const dc = pc.createDataChannel("oai-events");

  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
  pc.ontrack = (evt) => {
    remoteAudio.srcObject = evt.streams[0] ?? null;
  };

  async function handleProposeEdit(callId: string, argumentsJson: string) {
    let description = "";
    try {
      description = (JSON.parse(argumentsJson) as { description?: string }).description ?? "";
    } catch {
      // Malformed arguments — fall through with an empty description so the
      // backend's own validation (min length 1) rejects it cleanly below.
    }

    try {
      const response = await fetch("/api/design/astra/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, userUtterance: description }),
      });
      if (!response.ok) throw new Error("edit request failed");
      const result = (await response.json()) as AstraEditTurnResult;

      onImageUpdated(result);
      sendFunctionCallOutput(dc, callId, result.acknowledgement);
    } catch {
      onError("That edit didn't go through — try describing it again.");
      sendFunctionCallOutput(dc, callId, "Sorry, that edit failed — could you try describing it again?");
    }
  }

  dc.onmessage = (evt) => {
    let serverEvent: unknown;
    try {
      serverEvent = JSON.parse(evt.data);
    } catch {
      return;
    }
    if (!serverEvent || typeof serverEvent !== "object" || (serverEvent as { type?: unknown }).type !== "response.done") return;

    const { response } = serverEvent as RealtimeResponseDoneEvent;
    for (const item of response.output ?? []) {
      if (isFunctionCallOutput(item) && item.name === "propose_edit") {
        void handleProposeEdit(item.call_id, item.arguments);
      }
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
    body: offer.sdp,
  });
  if (!sdpResponse.ok) {
    throw new Error(`Failed to connect to the voice session (${sdpResponse.status})`);
  }
  const answerSdp = await sdpResponse.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return {
    disconnect() {
      micStream.getTracks().forEach((track) => track.stop());
      dc.close();
      pc.close();
    },
  };
}

function sendFunctionCallOutput(dc: RTCDataChannel, callId: string, output: string) {
  if (dc.readyState !== "open") return;
  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify({ acknowledgement: output }) },
    })
  );
  // Prompts the model to actually speak the acknowledgement — the function
  // result alone doesn't trigger a spoken response.
  dc.send(JSON.stringify({ type: "response.create" }));
}
