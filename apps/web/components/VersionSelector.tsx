"use client";

interface VersionSelectorProps {
  versions: { version: number }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function VersionSelector({ versions, selectedIndex, onSelect }: VersionSelectorProps) {
  if (versions.length < 2) return null;

  return (
    <div className="flex gap-2">
      {versions.map((v, i) => (
        <button
          key={v.version}
          type="button"
          onClick={() => onSelect(i)}
          className={
            i === selectedIndex
              ? "rounded bg-neutral-900 px-3 py-1 text-sm text-white"
              : "rounded border px-3 py-1 text-sm text-neutral-600"
          }
        >
          V{v.version}
        </button>
      ))}
    </div>
  );
}
