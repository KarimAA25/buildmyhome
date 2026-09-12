// The generated picture and its quote must always be traceable back to the
// contractor's own website (CLAUDE2 §1 rule 5, §53).
export function SourceAttribution({ sourceUrls }: { sourceUrls: string[] }) {
  if (sourceUrls.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 text-xs text-neutral-500">
      <span>Designed using:</span>
      <ul className="flex flex-col gap-0.5">
        {sourceUrls.map((url) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-800">
              {formatUrl(url)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}
