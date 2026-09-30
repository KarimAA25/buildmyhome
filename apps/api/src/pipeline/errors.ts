// Cross-contractor access and "no such design" collapse to the same error —
// routes map this to a plain 404, never revealing which case it was
// (CLAUDE2 §10 rule 6 — a design must never resolve across contractor
// boundaries, so from the caller's perspective it simply doesn't exist).
export class DesignNotFoundError extends Error {
  constructor() {
    super("Design not found");
    this.name = "DesignNotFoundError";
  }
}

export class VersionLimitReachedError extends Error {
  constructor(
    public readonly maxVersions: number,
    public readonly currentVersionCount: number
  ) {
    super("Maximum number of versions reached for this design");
    this.name = "VersionLimitReachedError";
  }
}

// A video modify call can't hand Runway a source video that doesn't exist
// yet or isn't finished rendering — the current version must be COMPLETED
// with a generatedVideoPath before it can be used as the edit source
// (CLAUDE3 §9 rule 4).
export class PreviousVersionNotReadyError extends Error {
  constructor() {
    super("The previous version is still processing or failed");
    this.name = "PreviousVersionNotReadyError";
  }
}
