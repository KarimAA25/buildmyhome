"use client";

import { useEffect, useRef, useState } from "react";
import {
  DesignCreateResponseSchema,
  DesignModifyResponseSchema,
  type DesignSpecification,
  type GenerationStatus,
  type ProgressState,
  type Quote,
} from "@buildmyhome/shared";
import { VideoUploader } from "@/components/VideoUploader";
import { PromptInput } from "@/components/PromptInput";
import { ResultPanel } from "@/components/ResultPanel";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { VersionSelector } from "@/components/VersionSelector";
import { parseSSEStream } from "@/lib/sseClient";
import { lookupDesignAction } from "@/app/actions";

type VideoDesignVersion = {
  versionNumber: number;
  designSpecification: DesignSpecification;
  generationStatus: GenerationStatus;
  generatedVideo: string | null;
  quote: Quote;
  sourceUrls: string[];
  changeRequest: string | null;
};

type ErrorEventData = {
  code?: string;
  message?: string;
  maxVersions?: number;
  currentVersionCount?: number;
};

// Mirrors the backend's own poll interval/timeout defaults
// (RUNWAY_POLL_INTERVAL_MS/RUNWAY_POLL_TIMEOUT_MS) for UX consistency —
// not a shared constant, since apps/web has no access to apps/api's env.
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 600_000;

function generatePromptNumber(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export function GenerateVideo() {
  const [promptNumber, setPromptNumber] = useState(generatePromptNumber);
  const [promptNumberNote, setPromptNumberNote] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [designId, setDesignId] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [versions, setVersions] = useState<VideoDesignVersion[]>([]);
  const [viewedVersionIndex, setViewedVersionIndex] = useState(0);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [versionLimit, setVersionLimit] = useState<{ max: number; current: number } | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const isGenerating = progressState !== null;
  const currentVersion = versions.at(-1) ?? null;
  const viewedVersion = versions[viewedVersionIndex] ?? currentVersion;
  const isViewingLatest = viewedVersion === currentVersion;
  const isProcessing = currentVersion?.generationStatus === "PROCESSING";
  const canGenerate = Boolean(video) && prompt.trim().length > 0 && email.trim().includes("@") && !isGenerating;
  const canModify =
    Boolean(currentVersion) &&
    currentVersion?.generationStatus === "COMPLETED" &&
    changeRequest.trim().length > 0 &&
    !isGenerating &&
    !versionLimit;

  // Polls GET /design/lookup (via the server action) until the latest
  // version's generationStatus leaves PROCESSING — this codebase's first
  // polling implementation; no SSE/setInterval precedent to reuse here since
  // the video render outlives the request/response cycle (CLAUDE3 §4).
  const pollingVersionRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentVersion || currentVersion.generationStatus !== "PROCESSING") return;
    if (pollingVersionRef.current === currentVersion.versionNumber) return;
    pollingVersionRef.current = currentVersion.versionNumber;

    const versionNumber = currentVersion.versionNumber;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    setPollTimedOut(false);

    const interval = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(interval);
        setPollTimedOut(true);
        return;
      }

      const outcome = await lookupDesignAction({ email, promptNumber, versionNumber });
      // A transient failure here isn't the video being unready — that's
      // PROCESSING, not an error — so just keep polling rather than surface it.
      if (!outcome.ok || outcome.data.mediaType !== "video") return;
      if (outcome.data.generationStatus === "PROCESSING") return;

      clearInterval(interval);
      pollingVersionRef.current = null;
      setVersions((prev) =>
        prev.map((v) =>
          v.versionNumber === versionNumber
            ? {
                ...v,
                generationStatus: outcome.data.generationStatus,
                generatedVideo:
                  outcome.data.generationStatus === "COMPLETED" && "generatedVideo" in outcome.data
                    ? (outcome.data.generatedVideo ?? null)
                    : null,
              }
            : v
        )
      );
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVersion?.versionNumber, currentVersion?.generationStatus]);

  async function handleGenerate() {
    if (!video) return;
    setError(null);
    setProgressState("ANALYZING");
    try {
      const response = await fetch("/api/design/create-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: "video",
          originalVideo: video,
          userPrompt: prompt,
          endUserEmail: email,
          promptNumber,
        }),
      });

      for await (const evt of parseSSEStream(response)) {
        if (evt.event === "progress") {
          setProgressState((evt.data as { state: ProgressState }).state);
        } else if (evt.event === "complete") {
          const result = DesignCreateResponseSchema.parse(evt.data);
          if (result.mediaType !== "video") return;
          setDesignId(result.designId);
          if (result.promptNumber !== promptNumber) {
            setPromptNumber(result.promptNumber);
            setPromptNumberNote("That prompt number was already in use — yours is now the one shown above.");
          }
          setVersions([
            {
              versionNumber: result.versionNumber,
              designSpecification: result.designSpecification,
              generationStatus: result.generationStatus,
              generatedVideo: "generatedVideo" in result ? (result.generatedVideo ?? null) : null,
              quote: result.quote,
              sourceUrls: result.sourceUrls,
              changeRequest: null,
            },
          ]);
          setViewedVersionIndex(0);
        } else if (evt.event === "error") {
          const data = evt.data as ErrorEventData;
          throw new Error(data.message ?? "Something went wrong generating your design. Please try again.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong generating your design. Please try again.");
    } finally {
      setProgressState(null);
    }
  }

  async function handleModify() {
    if (!currentVersion || !designId) return;
    setError(null);
    setProgressState("SEARCHING_PRODUCTS");
    try {
      const response = await fetch("/api/design/modify-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, changeRequest }),
      });

      for await (const evt of parseSSEStream(response)) {
        if (evt.event === "progress") {
          setProgressState((evt.data as { state: ProgressState }).state);
        } else if (evt.event === "complete") {
          const result = DesignModifyResponseSchema.parse(evt.data);
          if (result.mediaType !== "video") return;
          setVersions((prev) => [
            ...prev,
            {
              versionNumber: result.versionNumber,
              designSpecification: result.designSpecification,
              generationStatus: result.generationStatus,
              generatedVideo: "generatedVideo" in result ? (result.generatedVideo ?? null) : null,
              quote: result.quote,
              sourceUrls: result.sourceUrls,
              changeRequest,
            },
          ]);
          setViewedVersionIndex(versions.length);
          setChangeRequest("");
        } else if (evt.event === "error") {
          const data = evt.data as ErrorEventData;
          if (data.code === "VERSION_LIMIT_REACHED" && data.maxVersions && data.currentVersionCount) {
            setVersionLimit({ max: data.maxVersions, current: data.currentVersionCount });
          } else if (data.code === "PREVIOUS_VERSION_NOT_READY") {
            setError("The previous version hasn't finished rendering yet — please wait for it to complete.");
          } else {
            throw new Error(data.message ?? "Something went wrong applying that change. Please try again.");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong applying that change. Please try again.");
    } finally {
      setProgressState(null);
    }
  }

  function handleStartOver() {
    setVideo(null);
    setPrompt("");
    setChangeRequest("");
    setDesignId(null);
    setVersions([]);
    setViewedVersionIndex(0);
    setError(null);
    setVersionLimit(null);
    setPromptNumberNote(null);
    setPollTimedOut(false);
    pollingVersionRef.current = null;
  }

  return (
    <div className="flex flex-col gap-6">
      {!currentVersion || !video ? (
        <>
          <VideoUploader video={video} onVideoCaptured={setVideo} />
          <PromptInput value={prompt} onChange={setPrompt} />

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
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-fit rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Generate Video
          </button>
          {progressState && <ProgressIndicator state={progressState} />}
        </>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            Prompt number: <span className="font-mono font-semibold">{promptNumber}</span>
          </p>
          {promptNumberNote && <p className="text-xs text-amber-600">{promptNumberNote}</p>}

          <VersionSelector versions={versions} selectedIndex={viewedVersionIndex} onSelect={setViewedVersionIndex} />

          {viewedVersion && (
            <ResultPanel
              result={{
                versionNumber: viewedVersion.versionNumber,
                designSpecification: viewedVersion.designSpecification,
                mediaType: "video",
                generationStatus: viewedVersion.generationStatus,
                generatedVideo: viewedVersion.generatedVideo,
                quote: viewedVersion.quote,
                sourceUrls: viewedVersion.sourceUrls,
                changeRequest: viewedVersion.changeRequest,
              }}
            />
          )}

          {isProcessing && pollTimedOut && (
            <p className="text-xs text-amber-600">
              This is taking longer than expected — refresh or check back later via Retrieve Old.
            </p>
          )}

          {!isViewingLatest && (
            <p className="text-xs text-neutral-400">
              Viewing an earlier version — requesting a change applies to the latest one (V{currentVersion.versionNumber}).
            </p>
          )}

          {versionLimit ? (
            <p className="text-xs text-neutral-400">
              You&apos;ve reached the maximum of {versionLimit.max} versions for this design.
            </p>
          ) : isProcessing ? (
            <p className="text-xs text-neutral-500">Rendering your video — you can request a change once it finishes.</p>
          ) : (
            <PromptInput value={changeRequest} onChange={setChangeRequest} />
          )}
          <div className="flex gap-2">
            {!versionLimit && (
              <button
                type="button"
                onClick={handleModify}
                disabled={!canModify}
                className="w-fit rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                Request a Change
              </button>
            )}
            <button
              type="button"
              onClick={handleStartOver}
              disabled={isGenerating}
              className="w-fit rounded border px-4 py-2 text-sm disabled:opacity-40"
            >
              Start Over
            </button>
          </div>
          {progressState && <ProgressIndicator state={progressState} />}
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
