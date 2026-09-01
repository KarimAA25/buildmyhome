import { env } from "./config/env";
import { StubVisionProvider } from "./services/vision/StubVisionProvider";
import { OpenAIVisionProvider } from "./services/vision/OpenAIVisionProvider";
import { JsonFileCatalogProvider } from "./services/catalog/JsonFileCatalogProvider";
import { StubEmbeddingProvider } from "./services/embedding/StubEmbeddingProvider";
import { OpenAIEmbeddingProvider } from "./services/embedding/OpenAIEmbeddingProvider";
import { InMemoryCosineSimilaritySearchProvider } from "./services/productSearch/InMemoryCosineSimilaritySearchProvider";
import { StubDesignGenerationProvider } from "./services/designGeneration/StubDesignGenerationProvider";
import { OpenAIDesignGenerationProvider } from "./services/designGeneration/OpenAIDesignGenerationProvider";
import { DeterministicQuotationProvider } from "./services/quotation/DeterministicQuotationProvider";
import { StubImageGenerationProvider } from "./services/imageGeneration/StubImageGenerationProvider";
import { OpenAIImageGenerationProvider } from "./services/imageGeneration/OpenAIImageGenerationProvider";
import { NoOpImageValidationProvider } from "./services/imageValidation/NoOpImageValidationProvider";
import { OpenAIImageValidationProvider } from "./services/imageValidation/OpenAIImageValidationProvider";
import { NoOpPersistenceProvider } from "./services/persistence/NoOpPersistenceProvider";
import { InlineBase64StorageProvider } from "./services/storage/InlineBase64StorageProvider";
import { ConsoleLoggingAIUsageProvider } from "./services/aiUsage/ConsoleLoggingAIUsageProvider";

// Phase-1 composition root. Swap a provider here when a real implementation
// lands in a later phase — nothing outside this file should know which
// provider backs a given service interface.
// Vision and design generation fall back to their stubs until OPENAI_API_KEY
// and REASONING_MODEL are both configured in apps/api/.env — see CLAUDE.md §C,
// model IDs are never guessed.
const hasReasoningConfig = Boolean(env.OPENAI_API_KEY && env.REASONING_MODEL);
const hasEmbeddingConfig = Boolean(env.OPENAI_API_KEY && env.EMBEDDING_MODEL);
const hasImageConfig = Boolean(env.OPENAI_API_KEY && env.IMAGE_MODEL);

export const services = {
  vision: hasReasoningConfig ? new OpenAIVisionProvider() : new StubVisionProvider(),
  catalog: new JsonFileCatalogProvider(),
  embedding: hasEmbeddingConfig ? new OpenAIEmbeddingProvider() : new StubEmbeddingProvider(),
  productSearch: new InMemoryCosineSimilaritySearchProvider(),
  designGeneration: hasReasoningConfig ? new OpenAIDesignGenerationProvider() : new StubDesignGenerationProvider(),
  quotation: new DeterministicQuotationProvider(),
  imageGeneration: hasImageConfig ? new OpenAIImageGenerationProvider() : new StubImageGenerationProvider(),
  imageValidation: hasReasoningConfig ? new OpenAIImageValidationProvider() : new NoOpImageValidationProvider(),
  persistence: new NoOpPersistenceProvider(),
  storage: new InlineBase64StorageProvider(),
  aiUsage: new ConsoleLoggingAIUsageProvider(),
};
