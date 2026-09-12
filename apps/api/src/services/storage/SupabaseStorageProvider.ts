import { env } from "../../config/env";
import { parseDataUrl } from "../../lib/dataUrl";
import { supabase } from "../supabaseClient";
import type { ImageKind, StorageService, StoredImageRef } from "./StorageService";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour, per CLAUDE2 §6

function pathFor(contractorId: string, designId: string, kind: ImageKind): string {
  const fileName = kind === "original" ? "original.jpg" : `v${kind.version}.jpg`;
  return `${contractorId}/${designId}/${fileName}`;
}

export class SupabaseStorageProvider implements StorageService {
  private bucket() {
    return supabase.storage.from(env.SUPABASE_STORAGE_BUCKET);
  }

  async store(base64Image: string, contractorId: string, designId: string, kind: ImageKind): Promise<StoredImageRef> {
    const { mimeType, buffer } = parseDataUrl(base64Image);
    const path = pathFor(contractorId, designId, kind);

    const { error: uploadError } = await this.bucket().upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (uploadError) throw uploadError;

    return { path, signedUrl: await this.getSignedUrl(path) };
  }

  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await this.bucket().createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  }

  async retrieveAsBase64(path: string): Promise<string> {
    const { data, error } = await this.bucket().download(path);
    if (error) throw error;

    const arrayBuffer = await data.arrayBuffer();
    const mimeType = data.type || "image/jpeg";
    return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
  }
}
