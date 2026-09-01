import type { ProgressState } from "@buildmyhome/shared";
import { PROGRESS_LABELS } from "@/lib/progressLabels";

export function ProgressIndicator({ state }: { state: ProgressState }) {
  return (
    <p className="flex items-center gap-2 text-sm text-neutral-500">
      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-900" />
      {PROGRESS_LABELS[state]}
    </p>
  );
}
