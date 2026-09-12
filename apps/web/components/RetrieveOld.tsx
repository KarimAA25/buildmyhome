"use client";

import { useState } from "react";
import type { DesignLookupResponse } from "@buildmyhome/shared";
import { ResultPanel } from "@/components/ResultPanel";
import { lookupDesignAction } from "@/app/actions";

const GENERIC_NOT_FOUND_MESSAGE = "No design found for that email, prompt number, and version.";

export function RetrieveOld() {
  const [email, setEmail] = useState("");
  const [promptNumber, setPromptNumber] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DesignLookupResponse | null>(null);

  const canRetrieve =
    email.trim().includes("@") && /^\d{6}$/.test(promptNumber.trim()) && /^\d+$/.test(versionNumber.trim()) && !loading;

  async function handleRetrieve() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await lookupDesignAction({
        email: email.trim(),
        promptNumber: promptNumber.trim(),
        versionNumber: Number(versionNumber),
      });
      // Any failure — wrong email, wrong prompt number, or a version that
      // was never generated — renders the exact same generic message.
      // Never reveal which field was wrong (CLAUDE2 §1 rule 4).
      if (!outcome.ok) {
        setError(GENERIC_NOT_FOUND_MESSAGE);
        return;
      }
      setResult(outcome.data);
    } catch {
      setError(GENERIC_NOT_FOUND_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-1">
        <label className="text-sm">Prompt number</label>
        <input
          type="text"
          inputMode="numeric"
          value={promptNumber}
          onChange={(e) => setPromptNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="rounded border p-2 text-sm font-mono"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm">Version number</label>
        <input
          type="text"
          inputMode="numeric"
          value={versionNumber}
          onChange={(e) => setVersionNumber(e.target.value.replace(/\D/g, ""))}
          placeholder="1"
          className="rounded border p-2 text-sm font-mono"
        />
      </div>

      <button
        type="button"
        onClick={handleRetrieve}
        disabled={!canRetrieve}
        className="w-fit rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        Retrieve
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <ResultPanel
          result={{
            versionNumber: Number(versionNumber),
            designSpecification: result.designSpecification,
            generatedImage: result.generatedImage,
            quote: result.quote,
            sourceUrls: result.sourceUrls,
            changeRequest: null,
          }}
        />
      )}
    </div>
  );
}
