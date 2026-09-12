import type { ImageKind, StorageService, StoredImageRef } from "./StorageService";

// Kept for a fully offline/local demo mode (CLAUDE2.md intro) — images stay
// as inline base64, passed straight through instead of touching Supabase.
export class InlineBase64StorageProvider implements StorageService {
  async store(base64Image: string, _contractorId: string, _designId: string, _kind: ImageKind): Promise<StoredImageRef> {
    return { path: base64Image, signedUrl: base64Image };
  }

  async getSignedUrl(path: string): Promise<string> {
    return path;
  }

  async retrieveAsBase64(path: string): Promise<string> {
    return path;
  }
}
