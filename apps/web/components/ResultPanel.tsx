import type { DesignSpecification, GenerationStatus, Quote } from "@buildmyhome/shared";
import { BeforeAfter } from "./BeforeAfter";
import { QuoteBreakdown } from "./QuoteBreakdown";
import { SourceAttribution } from "./SourceAttribution";

interface ResultPanelBaseFields {
  versionNumber: number;
  designSpecification: DesignSpecification;
  // Null only for an unfinished Astra session — image/video always have one.
  quote: Quote | null;
  sourceUrls: string[];
  changeRequest: string | null;
}

interface ResultPanelProps {
  // Retrieval (GET /design/lookup) only returns the generated media, not the
  // original room photo — CLAUDE2 §2b/§2d describe the retrieved view as
  // showing "image, design specification summary, quote, source URL
  // attribution" (singular "image"), not a before/after comparison. This
  // component is still reused as-is (§2d), just without the comparison when
  // there's nothing to compare against. Only ever relevant for mediaType
  // "image" — video/astra have no equivalent before/after comparison.
  originalImage?: string | null;
  result:
    | (ResultPanelBaseFields & { mediaType: "image"; generatedImage: string })
    | (ResultPanelBaseFields & {
        mediaType: "video";
        generationStatus: GenerationStatus;
        // Present only once generationStatus is COMPLETED.
        generatedVideo: string | null;
      })
    | (ResultPanelBaseFields & {
        mediaType: "astra";
        // False until an explicit "End Session" or the idle-timeout
        // auto-finish has run — quote stays null until then.
        sessionFinished: boolean;
        generatedImage: string;
      });
}

// Used for the "Generate Image"/"Generate Video"/"Generate using Astra" flows
// and a successful "Retrieve Old" lookup — CLAUDE2 §2d requires the exact
// same results view for both, not a separate or reduced display.
export function ResultPanel({ originalImage, result }: ResultPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded border p-4">
      <div>
        {/* No version number is ever shown for Astra — it's a continuous
            session, not a discrete, addressable version (Stage 3.5 §3).
            A non-positive versionNumber means "latest, exact number unknown"
            (e.g. Retrieve Old with the version field left blank). */}
        <h2 className="text-lg font-semibold">
          {result.mediaType === "astra"
            ? "Astra Session Result"
            : result.versionNumber > 0
              ? `Version ${result.versionNumber}`
              : "Latest Version"}
        </h2>
        {result.changeRequest && (
          <p className="text-xs text-neutral-400">Change requested: &quot;{result.changeRequest}&quot;</p>
        )}
      </div>

      {result.mediaType === "video" ? (
        result.generationStatus === "COMPLETED" && result.generatedVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={result.generatedVideo} controls className="w-full rounded border" />
        ) : result.generationStatus === "FAILED" ? (
          <p className="text-sm text-red-600">Video generation failed. Please try again.</p>
        ) : (
          <p className="text-sm text-neutral-500">Rendering your video — this can take a few minutes…</p>
        )
      ) : originalImage ? (
        <BeforeAfter before={originalImage} after={result.generatedImage} />
      ) : (
        <img src={result.generatedImage} alt="Generated design" className="w-full rounded border" />
      )}

      <p className="text-sm">{result.designSpecification.summary}</p>

      {result.quote ? (
        <QuoteBreakdown quote={result.quote} />
      ) : (
        result.mediaType === "astra" && (
          <p className="text-sm text-neutral-500">This session hasn&apos;t finished yet — no quote has been generated.</p>
        )
      )}

      <SourceAttribution sourceUrls={result.sourceUrls} />
    </div>
  );
}
