"use client";

import { useState } from "react";
import {
  DesignCreateResponseSchema,
  DesignModifyResponseSchema,
  type DesignSpecification,
  type ProgressState,
  type Quote,
} from "@buildmyhome/shared";
import { ImageUploader } from "@/components/ImageUploader";
import { PromptInput } from "@/components/PromptInput";
import { ResultPanel } from "@/components/ResultPanel";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { VersionSelector } from "@/components/VersionSelector";
import { parseSSEStream } from "@/lib/sseClient";

type DesignVersion = {
  versionNumber: number;
  designSpecification: DesignSpecification;
  generatedImage: string;
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

function generatePromptNumber(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export function GenerateNew() {
  // Generated client-side the moment the page loads (CLAUDE2 §2b) — fixed
  // for the whole page session; only a reload produces a new one.
  const [promptNumber, setPromptNumber] = useState(generatePromptNumber);
  const [promptNumberNote, setPromptNumberNote] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [designId, setDesignId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [viewedVersionIndex, setViewedVersionIndex] = useState(0);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [versionLimit, setVersionLimit] = useState<{ max: number; current: number } | null>(null);

  const isGenerating = progressState !== null;
  const currentVersion = versions.at(-1) ?? null;
  const viewedVersion = versions[viewedVersionIndex] ?? currentVersion;
  const isViewingLatest = viewedVersion === currentVersion;
  const canGenerate = Boolean(image) && prompt.trim().length > 0 && email.trim().includes("@") && !isGenerating;
  const canModify = Boolean(currentVersion) && changeRequest.trim().length > 0 && !isGenerating && !versionLimit;

  async function handleGenerate() {
    if (!image) return;
    setError(null);
    setProgressState("ANALYZING");
    try {
      const response = await fetch("/api/design/create-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalImage: image, userPrompt: prompt, endUserEmail: email, promptNumber }),
      });

      for await (const evt of parseSSEStream(response)) {
        if (evt.event === "progress") {
          setProgressState((evt.data as { state: ProgressState }).state);
        } else if (evt.event === "complete") {
          const result = DesignCreateResponseSchema.parse(evt.data);
          setDesignId(result.designId);
          if (result.promptNumber !== promptNumber) {
            setPromptNumber(result.promptNumber);
            setPromptNumberNote("That prompt number was already in use — yours is now the one shown above.");
          }
          setVersions([
            {
              versionNumber: result.versionNumber,
              designSpecification: result.designSpecification,
              generatedImage: result.generatedImage,
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
          setVersions((prev) => [
            ...prev,
            {
              versionNumber: result.versionNumber,
              designSpecification: result.designSpecification,
              generatedImage: result.generatedImage,
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
    setImage(null);
    setPrompt("");
    setChangeRequest("");
    setDesignId(null);
    setVersions([]);
    setViewedVersionIndex(0);
    setError(null);
    setVersionLimit(null);
    setPromptNumberNote(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {!currentVersion || !image ? (
        <>
          <ImageUploader image={image} onImageCaptured={setImage} />
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
            Generate Design
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

          {viewedVersion && <ResultPanel originalImage={image} result={viewedVersion} />}

          {!isViewingLatest && (
            <p className="text-xs text-neutral-400">
              Viewing an earlier version — requesting a change applies to the latest one (V{currentVersion.versionNumber}).
            </p>
          )}

          {versionLimit ? (
            <p className="text-xs text-neutral-400">
              You&apos;ve reached the maximum of {versionLimit.max} versions for this design.
            </p>
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
