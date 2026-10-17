import { ModelProviderError, type ModelProvider, type ModelRequest, type ModelResponse } from '../model-provider';
import { withTransientRetry } from './provider-utils';

type MockContext = { mockMode?: unknown; mockKey?: unknown };

function getMockContext(value: unknown): MockContext {
  return value && typeof value === 'object' ? value as MockContext : {};
}

export class MockModelProvider implements ModelProvider {
  readonly id = 'mock' as const;
  constructor(private readonly defaultMode?: 'normal' | 'invalid' | 'throw') {}

  async health() { return { ok: true, detail: 'Deterministic mock provider is ready.' }; }

  async generate(req: ModelRequest): Promise<ModelResponse> {
    return withTransientRetry(async () => {
      const context = getMockContext(req.context);
      const mode = context.mockMode ?? this.defaultMode;
      if (mode === 'throw') {
        throw new ModelProviderError('unavailable', 'Mock provider failure requested.');
      }

      const key = typeof context.mockKey === 'string' ? context.mockKey : req.userMessage.trim().toLowerCase();
      const canned: Record<string, string> = {
        help: 'I can explain the supplied information and help navigate Finova.',
        greeting: 'Hello. I can help explain the information you provide.',
        summary: 'Here is a concise summary of the supplied context.',
        'open-weight': 'An open-weight model makes its trained parameters available for others to use.',
      };
      const text = mode === 'invalid'
        ? 'The account balance is ₹9,99,999.'
        : canned[key] ?? canned[req.userMessage.toLowerCase()] ?? 'I can help explain the information you provide.';

      return { text, model: mode === 'invalid' ? 'mock-invalid-figure' : 'mock', provider: this.id, latencyMs: 0 };
    });
  }
}
