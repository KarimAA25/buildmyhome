"use client";

interface TabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onSelect: (id: string) => void;
}

// Always visible from the top of the page, not surfaced only after
// generating something (CLAUDE2 §2d).
export function Tabs({ tabs, activeTab, onSelect }: TabsProps) {
  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={
            tab.id === activeTab
              ? "border-b-2 border-neutral-900 px-4 py-2 text-sm font-medium"
              : "border-b-2 border-transparent px-4 py-2 text-sm text-neutral-500"
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
