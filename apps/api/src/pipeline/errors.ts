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

// Thrown by applyAstraEdit when the session has already finished (explicit
// end or idle-timeout auto-finish) — an edit-turn can't apply to a session
// that's already been quoted and emailed. finishAstraSession itself is
// idempotent rather than throwing this — a repeat "End Session" click racing
// the idle timeout just re-returns the existing final result (Stage 3.5 §4).
export class SessionAlreadyFinishedError extends Error {
  constructor() {
    super("This Astra session has already finished");
    this.name = "SessionAlreadyFinishedError";
  }
}

// Thrown by StubAstraRealtimeProvider — unlike the other stub providers
// (which echo input so the rest of the pipeline works offline), a fake
// realtime token can't do a real WebRTC handshake, so this is honest about
// being unusable rather than pretending to work.
export class AstraNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AstraNotConfiguredError";
  }
}
