export function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="flex flex-col gap-1">
        <img src={before} alt="Original room" className="w-full rounded border" />
        <figcaption className="text-center text-xs text-neutral-500">Before</figcaption>
      </figure>
      <figure className="flex flex-col gap-1">
        <img src={after} alt="Generated design" className="w-full rounded border" />
        <figcaption className="text-center text-xs text-neutral-500">After</figcaption>
      </figure>
    </div>
  );
}
