import { env } from "./config/env";
import { StubVisionProvider } from "./services/vision/StubVisionProvider";
import { OpenAIVisionProvider } from "./services/vision/OpenAIVisionProvider";
import { JsonFileCatalogProvider } from "./services/catalog/JsonFileCatalogProvider";
import { StubEmbeddingProvider } from "./services/embedding/StubEmbeddingProvider";
import { OpenAIEmbeddingProvider } from "./services/embedding/OpenAIEmbeddingProvider";
import { InMemoryCosineSimilaritySearchProvider } from "./services/productSearch/InMemoryCosineSimilaritySearchProvider";
import { StubProductSourcingProvider } from "./services/productSourcing/StubProductSourcingProvider";
import { LiveContractorPageProvider } from "./services/productSourcing/LiveContractorPageProvider";
import { StubDesignGenerationProvider } from "./services/designGeneration/StubDesignGenerationProvider";
import { OpenAIDesignGenerationProvider } from "./services/designGeneration/OpenAIDesignGenerationProvider";
import { DeterministicQuotationProvider } from "./services/quotation/DeterministicQuotationProvider";
import { StubImageGenerationProvider } from "./services/imageGeneration/StubImageGenerationProvider";
import { OpenAIImageGenerationProvider } from "./services/imageGeneration/OpenAIImageGenerationProvider";
import { NoOpImageValidationProvider } from "./services/imageValidation/NoOpImageValidationProvider";
import { OpenAIImageValidationProvider } from "./services/imageValidation/OpenAIImageValidationProvider";
import { NoOpImageDiffProvider } from "./services/imageDiff/NoOpImageDiffProvider";
import { OpenAIImageDiffProvider } from "./services/imageDiff/OpenAIImageDiffProvider";
import { NoOpPersistenceProvider } from "./services/persistence/NoOpPersistenceProvider";
import { SupabasePersistenceProvider } from "./services/persistence/SupabasePersistenceProvider";
import { InlineBase64StorageProvider } from "./services/storage/InlineBase64StorageProvider";
import { SupabaseStorageProvider } from "./services/storage/SupabaseStorageProvider";
import { ConsoleLoggingAIUsageProvider } from "./services/aiUsage/ConsoleLoggingAIUsageProvider";
import { ConsoleLoggingEmailProvider } from "./services/email/ConsoleLoggingEmailProvider";
import { NodemailerGmailProvider } from "./services/email/NodemailerGmailProvider";

// Composition root. Swap a provider here when a real implementation lands —
// nothing outside this file should know which provider backs a given
// service interface.
// AI-backed providers fall back to stubs until OPENAI_API_KEY and
// REASONING_MODEL are both configured — see CLAUDE.md §C, model IDs are
// never guessed. Email falls back to console logging until Gmail creds are
// configured, same gating pattern.
const hasReasoningConfig = Boolean(env.OPENAI_API_KEY && env.REASONING_MODEL);
const hasEmbeddingConfig = Boolean(env.OPENAI_API_KEY && env.EMBEDDING_MODEL);
const hasImageConfig = Boolean(env.OPENAI_API_KEY && env.IMAGE_MODEL);
const hasEmailConfig = Boolean(env.GMAIL_SENDER_ADDRESS && env.GMAIL_APP_PASSWORD);

export const services = {
  vision: hasReasoningConfig ? new OpenAIVisionProvider() : new StubVisionProvider(),
  // catalog/embedding/productSearch are no longer used by the live
  // create/modify pipeline (CLAUDE2 §3 — productSourcing replaces them) but
  // stay wired for a possible fully offline/local demo mode later, per
  // CLAUDE2's instruction not to delete the old stubs. `embedding` is still
  // consumed directly by pipeline/refineDetectedItems.ts.
  catalog: new JsonFileCatalogProvider(),
  embedding: hasEmbeddingConfig ? new OpenAIEmbeddingProvider() : new StubEmbeddingProvider(),
  productSearch: new InMemoryCosineSimilaritySearchProvider(),
  productSourcing: hasReasoningConfig ? new LiveContractorPageProvider() : new StubProductSourcingProvider(),
  designGeneration: hasReasoningConfig ? new OpenAIDesignGenerationProvider() : new StubDesignGenerationProvider(),
  quotation: new DeterministicQuotationProvider(),
  imageGeneration: hasImageConfig ? new OpenAIImageGenerationProvider() : new StubImageGenerationProvider(),
  imageValidation: hasReasoningConfig ? new OpenAIImageValidationProvider() : new NoOpImageValidationProvider(),
  imageDiff: hasReasoningConfig ? new OpenAIImageDiffProvider() : new NoOpImageDiffProvider(),
  persistence: new SupabasePersistenceProvider(),
  storage: new SupabaseStorageProvider(),
  email: hasEmailConfig ? new NodemailerGmailProvider() : new ConsoleLoggingEmailProvider(),
  aiUsage: new ConsoleLoggingAIUsageProvider(),
};

// Kept available (not wired above) for the offline/local demo mode mentioned
// in CLAUDE2.md's intro — swap `persistence`/`storage` back to these two if
// that mode is ever needed.
export const offlineDemoProviders = {
  persistence: new NoOpPersistenceProvider(),
  storage: new InlineBase64StorageProvider(),
};
