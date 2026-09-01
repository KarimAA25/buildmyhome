export interface StorageService {
  store(image: string): Promise<string>;
  retrieve(reference: string): Promise<string>;
}
