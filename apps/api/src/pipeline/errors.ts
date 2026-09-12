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
