import type { DesignSpecification, Quote } from "@buildmyhome/shared";
import { BeforeAfter } from "./BeforeAfter";
import { QuoteBreakdown } from "./QuoteBreakdown";
import { SourceAttribution } from "./SourceAttribution";

interface ResultPanelProps {
  // Retrieval (GET /design/lookup) only returns the generated image, not the
  // original room photo — CLAUDE2 §2b/§2d describe the retrieved view as
  // showing "image, design specification summary, quote, source URL
  // attribution" (singular "image"), not a before/after comparison. This
  // component is still reused as-is (§2d), just without the comparison when
  // there's nothing to compare against.
  originalImage?: string | null;
  result: {
    versionNumber: number;
    designSpecification: DesignSpecification;
    generatedImage: string;
    quote: Quote;
    sourceUrls: string[];
    changeRequest: string | null;
  };
}

// Used for both the "Generate New" flow and a successful "Retrieve Old"
// lookup — CLAUDE2 §2d requires the exact same results view for both, not a
// separate or reduced display.
export function ResultPanel({ originalImage, result }: ResultPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded border p-4">
      <div>
        <h2 className="text-lg font-semibold">Version {result.versionNumber}</h2>
        {result.changeRequest && (
          <p className="text-xs text-neutral-400">Change requested: &quot;{result.changeRequest}&quot;</p>
        )}
      </div>

      {originalImage ? (
        <BeforeAfter before={originalImage} after={result.generatedImage} />
      ) : (
        <img src={result.generatedImage} alt="Generated design" className="w-full rounded border" />
      )}

      <p className="text-sm">{result.designSpecification.summary}</p>

      <QuoteBreakdown quote={result.quote} />

      <SourceAttribution sourceUrls={result.sourceUrls} />
    </div>
  );
}
