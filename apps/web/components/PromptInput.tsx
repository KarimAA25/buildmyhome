"use client";

import { MAX_PROMPT_LENGTH_UI } from "@/lib/constants";

export function PromptInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_PROMPT_LENGTH_UI))}
        placeholder="Describe the design you want..."
        rows={4}
        className="rounded border p-2 text-sm"
      />
      <span className="text-right text-xs text-neutral-400">
        {value.length}/{MAX_PROMPT_LENGTH_UI}
      </span>
    </div>
  );
}
