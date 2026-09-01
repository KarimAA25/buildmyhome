import type { StorageService } from "./StorageService";

export class InlineBase64StorageProvider implements StorageService {
  async store(image: string): Promise<string> {
    return image;
  }

  async retrieve(reference: string): Promise<string> {
    return reference;
  }
}
