import type { ImageKind, MediaBucket, StorageService, StoredImageRef } from "./StorageService";

// Kept for a fully offline/local demo mode (CLAUDE2.md intro) — images stay
// as inline base64, passed straight through instead of touching Supabase.
export class InlineBase64StorageProvider implements StorageService {
  async store(base64Image: string, _contractorId: string, _designId: string, _kind: ImageKind, _bucket?: MediaBucket): Promise<StoredImageRef> {
    return { path: base64Image, signedUrl: base64Image };
  }

  async getSignedUrl(path: string, _bucket: MediaBucket): Promise<string> {
    return path;
  }

  async retrieveAsBase64(path: string, _bucket?: MediaBucket): Promise<string> {
    return path;
  }

  async storeVideoFromUrl(sourceUrl: string, _contractorId: string, _designId: string, _versionNumber: number): Promise<StoredImageRef> {
    return { path: sourceUrl, signedUrl: sourceUrl };
  }
}
