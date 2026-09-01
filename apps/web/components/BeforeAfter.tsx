"use client";

import { useState } from "react";
import { ImageLightbox } from "./ImageLightbox";

export function BeforeAfter({ before, after }: { before: string; after: string }) {
  const [expanded, setExpanded] = useState<"before" | "after" | null>(null);

  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="flex flex-col gap-1">
        <img
          src={before}
          alt="Original room"
          className="w-full cursor-zoom-in rounded border"
          onClick={() => setExpanded("before")}
        />
        <figcaption className="text-center text-xs text-neutral-500">Before</figcaption>
      </figure>
      <figure className="flex flex-col gap-1">
        <img
          src={after}
          alt="Generated design"
          className="w-full cursor-zoom-in rounded border"
          onClick={() => setExpanded("after")}
        />
        <figcaption className="text-center text-xs text-neutral-500">After</figcaption>
      </figure>

      {expanded && (
        <ImageLightbox
          src={expanded === "before" ? before : after}
          alt={expanded === "before" ? "Original room" : "Generated design"}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
