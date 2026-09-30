import { env } from "../../config/env";
import { parseDataUrl } from "../../lib/dataUrl";
import { supabase } from "../supabaseClient";
import type { ImageKind, MediaBucket, StorageService, StoredImageRef } from "./StorageService";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour, per CLAUDE2 §6

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME_TYPE[mimeType] ?? mimeType.split("/")[1] ?? "bin";
}

function pathFor(contractorId: string, designId: string, kind: ImageKind, extension: string): string {
  const fileName = kind === "original" ? `original.${extension}` : `v${kind.version}.${extension}`;
  return `${contractorId}/${designId}/${fileName}`;
}

function bucketNameFor(bucket: MediaBucket): string {
  switch (bucket) {
    case "video":
      return env.SUPABASE_VIDEO_STORAGE_BUCKET;
    case "astra":
      return env.SUPABASE_STORAGE_BUCKET_ASTRA;
    default:
      return env.SUPABASE_STORAGE_BUCKET;
  }
}

export class SupabaseStorageProvider implements StorageService {
  private bucket(bucket: MediaBucket) {
    return supabase.storage.from(bucketNameFor(bucket));
  }

  async store(base64Media: string, contractorId: string, designId: string, kind: ImageKind, bucketOverride?: MediaBucket): Promise<StoredImageRef> {
    const { mimeType, buffer } = parseDataUrl(base64Media);
    const bucket: MediaBucket = bucketOverride ?? (mimeType.startsWith("video/") ? "video" : "image");
    const path = pathFor(contractorId, designId, kind, extensionFor(mimeType));

    const { error: uploadError } = await this.bucket(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (uploadError) throw uploadError;

    return { path, signedUrl: await this.getSignedUrl(path, bucket) };
  }

  async storeVideoFromUrl(sourceUrl: string, contractorId: string, designId: string, versionNumber: number): Promise<StoredImageRef> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`storeVideoFromUrl: failed to download source video (${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const path = pathFor(contractorId, designId, { version: versionNumber }, "mp4");

    const { error: uploadError } = await this.bucket("video").upload(path, buffer, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    return { path, signedUrl: await this.getSignedUrl(path, "video") };
  }

  async getSignedUrl(path: string, bucket: MediaBucket): Promise<string> {
    const { data, error } = await this.bucket(bucket).createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  }

  async retrieveAsBase64(path: string, bucket: MediaBucket = "image"): Promise<string> {
    const { data, error } = await this.bucket(bucket).download(path);
    if (error) throw error;

    const arrayBuffer = await data.arrayBuffer();
    const mimeType = data.type || "image/jpeg";
    return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
  }
}
