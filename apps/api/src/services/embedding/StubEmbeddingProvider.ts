import type { EmbeddingService } from "./EmbeddingService";

const STUB_DIMENSIONS = 8;

export class StubEmbeddingProvider implements EmbeddingService {
  async embed(_text: string): Promise<number[]> {
    return new Array(STUB_DIMENSIONS).fill(0);
  }
}
