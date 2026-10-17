import type { ModelConfig } from '../model-config';
import { ModelProviderError, type ModelProvider, type ModelRequest, type ModelResponse } from '../model-provider';
import { fetchWithTimeout, providerErrorForStatus, readJson, withTransientRetry } from './provider-utils';
import { untrustedUserContent } from '../prompts';

type OllamaPayload = { model?: unknown; message?: { content?: unknown } };

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama' as const;

  constructor(private readonly config: Pick<ModelConfig, 'ollamaBaseUrl' | 'ollamaModel' | 'modelTimeoutMs'>) {}

  async health() {
    if (!this.config.ollamaModel) return { ok: false, detail: 'OLLAMA_MODEL is not configured.' };
    try {
      await withTransientRetry(async () => {
        const response = await fetchWithTimeout(
          `${this.config.ollamaBaseUrl}/api/tags`, { method: 'GET' }, this.config.modelTimeoutMs, this.id,
        );
        if (!response.ok) throw providerErrorForStatus(response.status, 'Ollama');
      });
      return { ok: true, detail: `Ollama is reachable; model ${this.config.ollamaModel} is configured.` };
    } catch (error) {
      return { ok: false, detail: error instanceof ModelProviderError ? error.code : 'unavailable' };
    }
  }

  async generate(req: ModelRequest): Promise<ModelResponse> {
    if (!this.config.ollamaModel) throw new ModelProviderError('bad_response', 'OLLAMA_MODEL is not configured.');
    const started = performance.now();
    const timeoutMs = req.timeoutMs ?? this.config.modelTimeoutMs;
    const model = this.config.ollamaModel;
    const userContent = untrustedUserContent(req.userMessage, req.context, req.locale ?? 'en');
    const text = await withTransientRetry(async () => {
      const response = await fetchWithTimeout(`${this.config.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: req.system }, { role: 'user', content: userContent }], stream: false, options: { num_predict: req.maxTokens ?? 512 } }),
      }, timeoutMs, this.id);
      if (!response.ok) throw providerErrorForStatus(response.status, 'Ollama');
      const payload = await readJson(response, 'Ollama') as OllamaPayload;
      if (typeof payload.message?.content !== 'string' || !payload.message.content.trim()) {
        throw new ModelProviderError('bad_response', 'Ollama returned no text.');
      }
      return payload.message.content.trim();
    });
    return { text, model, provider: this.id, latencyMs: Math.round(performance.now() - started) };
  }
}
