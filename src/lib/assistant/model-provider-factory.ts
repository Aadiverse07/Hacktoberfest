import { resolveModelConfig, type ModelConfig } from './model-config';
import type { ModelProvider } from './model-provider';
import { GemmaGeminiProvider } from './providers/gemma-gemini';
import { MockModelProvider } from './providers/mock';
import { OllamaProvider } from './providers/ollama';

/** Selects the configured provider. resolveModelConfig safely falls back to mock if credentials are missing. */
export function createModelProvider(config: ModelConfig = resolveModelConfig()): ModelProvider {
  switch (config.provider) {
    case 'gemma-gemini':
      return new GemmaGeminiProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'mock':
    default:
      return new MockModelProvider();
  }
}

export { ModelProviderError } from './model-provider';
export type { ModelProvider, ModelProviderErrorCode, ModelRequest, ModelResponse } from './model-provider';
