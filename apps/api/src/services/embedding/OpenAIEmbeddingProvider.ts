import OpenAI from "openai";
import { env } from "../../config/env";
import type { EmbeddingService } from "./EmbeddingService";

export class OpenAIEmbeddingProvider implements EmbeddingService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: text,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error("EmbeddingService: OpenAI returned no embedding data");
    }
    return embedding;
  }
}
