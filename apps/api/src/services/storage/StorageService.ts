export type ImageKind = "original" | { version: number };

// Images, videos, and Astra session images each live in their own Supabase
// Storage bucket (SUPABASE_STORAGE_BUCKET / SUPABASE_VIDEO_STORAGE_BUCKET /
// SUPABASE_STORAGE_BUCKET_ASTRA) — a stored path alone doesn't say which
// bucket it's in, so callers of getSignedUrl must say explicitly rather than
// have it guessed from the path/extension.
export type MediaBucket = "image" | "video" | "astra";

export interface StoredImageRef {
  // Storage object path — this is what gets persisted in the database
  // (CLAUDE2 §6: the DB stores the path, never a permanent public URL).
  path: string;
  // Short-lived signed URL, safe to return directly in an API response.
  signedUrl: string;
}

export interface StorageService {
  // Routes to the image or video bucket internally based on the base64 data
  // URL's own mimeType (image/* vs video/*) by default — used for original
  // room photos, original room videos, and generated version images. Astra
  // images are image/* too, so mimeType inference alone can't tell them
  // apart from design-images; pass `bucket: "astra"` explicitly for those.
  store(base64Media: string, contractorId: string, designId: string, kind: ImageKind, bucket?: MediaBucket): Promise<StoredImageRef>;
  getSignedUrl(path: string, bucket: MediaBucket): Promise<string>;
  // Needed internally: OpenAI's image-edit call takes an uploaded file, not
  // a URL, so a prior version's image has to come back as real bytes to seed
  // the next modify/edit call. Defaults to the image bucket (every existing
  // call site is unchanged); Astra call sites pass `"astra"` explicitly.
  retrieveAsBase64(path: string, bucket?: MediaBucket): Promise<string>;
  // Downloads a remote URL's bytes and persists them to the video bucket —
  // used for Runway's ephemeral video_to_video output, which expires in
  // 24-48h and must never be exposed to the client or stored as a permanent
  // reference (CLAUDE3 §9.1).
  storeVideoFromUrl(sourceUrl: string, contractorId: string, designId: string, versionNumber: number): Promise<StoredImageRef>;
}
