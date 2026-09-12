export type ImageKind = "original" | { version: number };

export interface StoredImageRef {
  // Storage object path — this is what gets persisted in the database
  // (CLAUDE2 §6: the DB stores the path, never a permanent public URL).
  path: string;
  // Short-lived signed URL, safe to return directly in an API response.
  signedUrl: string;
}

export interface StorageService {
  store(base64Image: string, contractorId: string, designId: string, kind: ImageKind): Promise<StoredImageRef>;
  getSignedUrl(path: string): Promise<string>;
  // Needed internally: OpenAI's image-edit call takes an uploaded file, not
  // a URL, so a prior version's image has to come back as real bytes to
  // seed the next modify call.
  retrieveAsBase64(path: string): Promise<string>;
}
