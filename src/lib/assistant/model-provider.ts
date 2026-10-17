export type ModelRequest = {
  system: string;
  userMessage: string;
  context: unknown;
  locale?: string;
  maxTokens?: number;
  timeoutMs?: number;
};

export type ModelResponse = {
  text: string;
  model: string;
  provider: string;
  latencyMs: number;
};

export type ModelProviderId = 'mock' | 'gemma-gemini' | 'ollama';
export type ModelProviderErrorCode = 'timeout' | 'auth' | 'rate_limit' | 'unavailable' | 'bad_response';

export class ModelProviderError extends Error {
  constructor(
    public readonly code: ModelProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ModelProviderError';
  }
}

export interface ModelProvider {
  readonly id: ModelProviderId;
  health(): Promise<{ ok: boolean; detail?: string }>;
  generate(req: ModelRequest): Promise<ModelResponse>;
}
