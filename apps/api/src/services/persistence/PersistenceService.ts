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
  quote: Quote;
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
  quote: Quote;
  // Omitted by image call sites — the DB default ('COMPLETED') applies
  // unchanged, zero existing call-site changes needed. Video call sites pass
  // 'PROCESSING' explicitly.
  generationStatus?: Extract<GenerationStatus, "PROCESSING" | "COMPLETED">;
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
  versionNumber: number;
}

export interface PersistenceService {
  // Handles the (contractor_id, prompt_number) collision retry internally
  // (CLAUDE2 §2b) — the returned design's promptNumber may differ from the
  // one requested; the caller (route) must detect and surface that.
  createDesign(input: CreateDesignInput): Promise<PersistedDesign>;
  getDesign(designId: string): Promise<PersistedDesign | null>;
  getLatestVersion(designId: string): Promise<PersistedVersion | null>;
  getVersionCount(designId: string): Promise<number>;
  createVersion(input: CreateVersionInput): Promise<PersistedVersion>;
  // Flips a video version from PROCESSING to COMPLETED/FAILED once the
  // detached Runway render resolves (CLAUDE3 §3 steps 5-6).
  updateVersionStatus(input: UpdateVersionStatusInput): Promise<void>;
  // Returns null for ANY mismatch (wrong email, wrong prompt number, wrong/
  // never-generated version) — callers must never be able to tell which
  // field was wrong (CLAUDE2 §1 rule 4).
  lookup(credentials: LookupCredentials): Promise<{ design: PersistedDesign; version: PersistedVersion } | null>;
}
