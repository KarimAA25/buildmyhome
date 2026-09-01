export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
}
