import type { DesignSpecification, Quote } from "@buildmyhome/shared";
import { BeforeAfter } from "./BeforeAfter";
import { QuoteBreakdown } from "./QuoteBreakdown";

interface ResultPanelProps {
  originalImage: string;
  result: {
    version: number;
    designSpecification: DesignSpecification;
    generatedImage: string;
    quote: Quote;
    changeRequest: string | null;
  };
}

export function ResultPanel({ originalImage, result }: ResultPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded border p-4">
      <div>
        <h2 className="text-lg font-semibold">Version {result.version}</h2>
        {result.changeRequest && (
          <p className="text-xs text-neutral-400">Change requested: &quot;{result.changeRequest}&quot;</p>
        )}
      </div>

      <BeforeAfter before={originalImage} after={result.generatedImage} />

      <p className="text-sm">{result.designSpecification.summary}</p>

      <QuoteBreakdown quote={result.quote} />
    </div>
  );
}
