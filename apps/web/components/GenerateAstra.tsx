"use client";

import { useState } from "react";
import type { DesignSpecification } from "@buildmyhome/shared";
import { ImageUploader } from "@/components/ImageUploader";
import { ResultPanel } from "@/components/ResultPanel";
import { startAstraSessionAction, finishAstraSessionAction } from "@/app/actions";
import { connectAstraRealtime, type AstraRealtimeConnection } from "@/lib/astraRealtime";

function generatePromptNumber(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

type SessionState = "idle" | "connecting" | "live" | "finishing" | "finished";

export function GenerateAstra() {
  const [promptNumber, setPromptNumber] = useState(generatePromptNumber);
  const [promptNumberNote, setPromptNumberNote] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentSpec, setCurrentSpec] = useState<DesignSpecification | null>(null);
  const [lastAcknowledgement, setLastAcknowledgement] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<AstraRealtimeConnection | null>(null);
  const [finalResult, setFinalResult] = useState<{
    designSpecification: DesignSpecification;
    quote: import("@buildmyhome/shared").Quote;
    sourceUrls: string[];
  } | null>(null);

  const canStart = Boolean(image) && email.trim().includes("@") && sessionState === "idle";
  const isLive = sessionState === "live";

  async function handleStart() {
    if (!image) return;
    setError(null);
    setSessionState("connecting");
    try {
      const result = await startAstraSessionAction({
        endUserEmail: email,
        promptNumber,
        originalImage: image,
      });

      if (result.promptNumber !== promptNumber) {
        setPromptNumber(result.promptNumber);
        setPromptNumberNote("That prompt number was already in use — yours is now the one shown above.");
      }
      setDesignId(result.designId);
      setCurrentImage(image);

      const conn = await connectAstraRealtime({
        token: result.realtimeSession.token,
        designId: result.designId,
        onImageUpdated: (editResult) => {
          setCurrentImage(editResult.generatedImage);
          setCurrentSpec(editResult.designSpecification);
          setLastAcknowledgement(editResult.acknowledgement);
        },
        onError: (message) => setError(message),
      });

      setConnection(conn);
      setSessionState("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the voice session. Please try again.");
      setSessionState("idle");
    }
  }

  async function handleEndSession() {
    if (!designId) return;
    setSessionState("finishing");
    connection?.disconnect();
    setConnection(null);
    try {
      const result = await finishAstraSessionAction({ designId });
      setFinalResult({
        designSpecification: result.designSpecification,
        quote: result.quote,
        sourceUrls: result.sourceUrls,
      });
      setSessionState("finished");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish the session. Please try again.");
      setSessionState("live");
    }
  }

  function handleStartOver() {
    connection?.disconnect();
    setConnection(null);
    setImage(null);
    setDesignId(null);
    setSessionState("idle");
    setCurrentImage(null);
    setCurrentSpec(null);
    setLastAcknowledgement(null);
    setFinalResult(null);
    setError(null);
    setPromptNumberNote(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {sessionState === "idle" ? (
        <>
          <ImageUploader image={image} onImageCaptured={setImage} />

          <div className="flex flex-col gap-1">
            <label className="text-sm">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded border p-2 text-sm"
            />
          </div>

          <p className="text-xs text-neutral-500">
            Your prompt number: <span className="font-mono font-semibold">{promptNumber}</span>
            <br />
            Save this — you&apos;ll need it with your email to find this design again.
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="w-fit rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Start Voice Session
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            Prompt number: <span className="font-mono font-semibold">{promptNumber}</span>
          </p>
          {promptNumberNote && <p className="text-xs text-amber-600">{promptNumberNote}</p>}

          {sessionState === "connecting" && <p className="text-sm text-neutral-500">Connecting…</p>}

          {(isLive || sessionState === "finishing") && currentImage && (
            <div className="flex flex-col gap-3 rounded border p-4">
              {/* No version gallery, no version picker — a continuous session,
                  not a discrete, addressable set of versions (Stage 3.5 §3). */}
              <img src={currentImage} alt="Current room design" className="w-full rounded border" />
              {currentSpec && <p className="text-sm">{currentSpec.summary}</p>}
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <span className={`h-2 w-2 rounded-full ${isLive ? "animate-pulse bg-green-600" : "bg-neutral-400"}`} />
                {isLive ? "Listening — describe what you'd like to change." : "Finishing session…"}
              </p>
              {lastAcknowledgement && <p className="text-xs text-neutral-400">&quot;{lastAcknowledgement}&quot;</p>}
            </div>
          )}

          {isLive && (
            <button
              type="button"
              onClick={handleEndSession}
              className="w-fit rounded bg-neutral-900 px-4 py-2 text-sm text-white"
            >
              End Session
            </button>
          )}

          {sessionState === "finished" && finalResult && (
            <>
              <ResultPanel
                result={{
                  versionNumber: 0,
                  designSpecification: finalResult.designSpecification,
                  mediaType: "astra",
                  sessionFinished: true,
                  generatedImage: currentImage ?? "",
                  quote: finalResult.quote,
                  sourceUrls: finalResult.sourceUrls,
                  changeRequest: null,
                }}
              />
              <button
                type="button"
                onClick={handleStartOver}
                className="w-fit rounded border px-4 py-2 text-sm"
              >
                Start Over
              </button>
            </>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
