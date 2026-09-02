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
  version: number;
  designSpecification: DesignSpecification;
  generatedImage: string;
  quote: Quote;
  changeRequest: string | null;
};

const MAX_VERSIONS = 3;

export default function WorkspacePage() {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [viewedVersionIndex, setViewedVersionIndex] = useState(0);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isGenerating = progressState !== null;
  const currentVersion = versions.at(-1) ?? null;
  const viewedVersion = versions[viewedVersionIndex] ?? currentVersion;
  const isViewingLatest = viewedVersion === currentVersion;
  const canGenerate = Boolean(image) && prompt.trim().length > 0 && !isGenerating;
  const atMaxVersions = versions.length >= MAX_VERSIONS;
  const canModify = Boolean(currentVersion) && changeRequest.trim().length > 0 && !isGenerating && !atMaxVersions;

  async function handleGenerate() {
    if (!image) return;
    setError(null);
    setProgressState("ANALYZING");
    try {
      const response = await fetch("/api/design/create-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalImage: image, userPrompt: prompt }),
      });

      for await (const evt of parseSSEStream(response)) {
        if (evt.event === "progress") {
          setProgressState((evt.data as { state: ProgressState }).state);
        } else if (evt.event === "complete") {
          const result = DesignCreateResponseSchema.parse(evt.data);
          setVersions([{ ...result, changeRequest: null }]);
          setViewedVersionIndex(0);
        } else if (evt.event === "error") {
          throw new Error((evt.data as { message: string }).message);
        }
      }
    } catch {
      setError("Something went wrong generating your design. Please try again.");
    } finally {
      setProgressState(null);
    }
  }

  async function handleModify() {
    if (!currentVersion) return;
    setError(null);
    setProgressState("SEARCHING_PRODUCTS");
    try {
      const response = await fetch("/api/design/modify-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentImage: currentVersion.generatedImage,
          currentDesignSpecification: currentVersion.designSpecification,
          changeRequest,
          versionNumber: currentVersion.version,
        }),
      });

      for await (const evt of parseSSEStream(response)) {
        if (evt.event === "progress") {
          setProgressState((evt.data as { state: ProgressState }).state);
        } else if (evt.event === "complete") {
          const result = DesignModifyResponseSchema.parse(evt.data);
          setVersions((prev) => [...prev, { ...result, changeRequest }]);
          setViewedVersionIndex(versions.length);
          setChangeRequest("");
        } else if (evt.event === "error") {
          throw new Error((evt.data as { message: string }).message);
        }
      }
    } catch {
      setError("Something went wrong applying that change. Please try again.");
    } finally {
      setProgressState(null);
    }
  }

  function handleStartOver() {
    setImage(null);
    setPrompt("");
    setChangeRequest("");
    setVersions([]);
    setViewedVersionIndex(0);
    setError(null);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">BuildMyHome</h1>

      {!currentVersion || !image ? (
        <>
          <ImageUploader image={image} onImageCaptured={setImage} />
          <PromptInput value={prompt} onChange={setPrompt} />
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
          <VersionSelector versions={versions} selectedIndex={viewedVersionIndex} onSelect={setViewedVersionIndex} />

          {viewedVersion && <ResultPanel originalImage={image} result={viewedVersion} />}

          {!isViewingLatest && (
            <p className="text-xs text-neutral-400">
              Viewing an earlier version — requesting a change applies to the latest one (V{currentVersion.version}).
            </p>
          )}

          {atMaxVersions ? (
            <p className="text-xs text-neutral-400">
              Maximum of {MAX_VERSIONS} versions reached for this session.
            </p>
          ) : (
            <PromptInput value={changeRequest} onChange={setChangeRequest} />
          )}
          <div className="flex gap-2">
            {!atMaxVersions && (
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
    </main>
  );
}
