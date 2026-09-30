import type { DesignSpecification, GenerationStatus, MediaType, Quote } from "@buildmyhome/shared";

export interface PersistedDesign {
  id: string;
  contractorId: string;
  endUserEmail: string;
  promptNumber: string;
  // Storage path, not a real URL — see CLAUDE2 §6 (the designs.original_image_url
  // column stores the path; a signed URL is minted from it on demand). Reused
  // generically for the original video's path too on video-thread designs —
  // there is no separate original_video_url column (CLAUDE3 §5).
  originalImagePath: string;
  maxVersions: number | null;
  mediaType: MediaType;
  // Astra only — null until an explicit "End Session" or the idle-timeout
  // auto-finish runs. Always null for image/video designs (Stage 3.5 §4).
  astraFinishedAt: string | null;
}

export interface PersistedVersion {
  id: string;
  designId: string;
  versionNumber: number;
  parentVersionId: string | null;
  // Storage path, same caveat as PersistedDesign.originalImagePath. Empty
  // string for a video-thread version (no image was ever generated for it).
  generatedImagePath: string;
  designSpecification: DesignSpecification;
  sourceUrls: string[];
  // Null for an in-progress Astra edit-turn (no quote is computed per turn —
  // only once, at session finish, Stage 3.5 §4/§11 rule 4). Always present
  // for image/video versions; see attachQuote's quoteOptional behavior.
  quote: Quote | null;
  generationStatus: GenerationStatus;
  generatedVideoPath: string | null;
  videoDurationSeconds: number | null;
  // Server-side debugging detail only — never returned to the client (see
  // routes/design.ts's lookup handler).
  generationError: string | null;
}

export interface CreateDesignInput {
  // Caller-generated (randomUUID) so the image can be uploaded to
  // {contractorId}/{designId}/original.jpg BEFORE the design row exists —
  // the row needs original_image_url populated on insert.
  id: string;
  contractorId: string;
  endUserEmail: string;
  promptNumber: string;
  originalImagePath: string;
  mediaType: MediaType;
}

export interface CreateVersionInput {
  designId: string;
  versionNumber: number;
  parentVersionId: string | null;
  // Null for a video-thread version at creation time (PROCESSING, no
  // rendered image ever exists for it).
  generatedImagePath: string | null;
  designSpecification: DesignSpecification;
  userInstruction: string | null;
  sourceUrls: string[];
  aiModel: string | null;
  // Null for an Astra edit-turn (no quote per turn — see PersistedVersion.quote).
  quote: Quote | null;
  // Omitted by image call sites — the DB default ('COMPLETED') applies
  // unchanged, zero existing call-site changes needed. Video call sites pass
  // 'PROCESSING' explicitly.
  generationStatus?: Extract<GenerationStatus, "PROCESSING" | "COMPLETED">;
}

export interface AttachQuoteInput {
  versionId: string;
  quote: Quote;
}

export interface UpdateVersionStatusInput {
  versionId: string;
  status: Extract<GenerationStatus, "COMPLETED" | "FAILED">;
  // Required when status is COMPLETED.
  generatedVideoPath?: string;
  videoDurationSeconds?: number;
  // Required when status is FAILED.
  generationError?: string;
}

export interface LookupCredentials {
  contractorId: string;
  email: string;
  promptNumber: string;
  // Null/omitted means "latest version" — always the case for astra threads
  // (no version concept is exposed), and now also valid for image/video
  // (Stage 3.5 §5 rule 8, extended beyond astra).
  versionNumber: number | null;
}

export interface GetLatestVersionOptions {
  // False (default) preserves existing behavior for image/video: a missing
  // quote row means corrupted/legacy data, treated as "not found." Astra
  // call sites pass true — a missing quote row there is a legitimate
  // in-progress edit-turn, not an error.
  quoteOptional?: boolean;
}

export interface PersistenceService {
  // Handles the (contractor_id, prompt_number) collision retry internally
  // (CLAUDE2 §2b) — the returned design's promptNumber may differ from the
  // one requested; the caller (route) must detect and surface that.
  createDesign(input: CreateDesignInput): Promise<PersistedDesign>;
  getDesign(designId: string): Promise<PersistedDesign | null>;
  getLatestVersion(designId: string, opts?: GetLatestVersionOptions): Promise<PersistedVersion | null>;
  getVersionCount(designId: string): Promise<number>;
  createVersion(input: CreateVersionInput): Promise<PersistedVersion>;
  // Flips a video version from PROCESSING to COMPLETED/FAILED once the
  // detached Runway render resolves (CLAUDE3 §3 steps 5-6).
  updateVersionStatus(input: UpdateVersionStatusInput): Promise<void>;
  // Attaches a quote to an EXISTING version row — used at Astra session
  // finish, which computes the quote once and attaches it to the latest
  // version rather than minting a new one (Stage 3.5 §3/§4).
  attachQuoteToVersion(input: AttachQuoteInput): Promise<void>;
  // Sets designs.astra_finished_at = now() (Stage 3.5 §4).
  markAstraFinished(designId: string): Promise<void>;
  // Returns null for ANY mismatch (wrong email, wrong prompt number, wrong/
  // never-generated version) — callers must never be able to tell which
  // field was wrong (CLAUDE2 §1 rule 4).
  lookup(credentials: LookupCredentials): Promise<{ design: PersistedDesign; version: PersistedVersion } | null>;
}
