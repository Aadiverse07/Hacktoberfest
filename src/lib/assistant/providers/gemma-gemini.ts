import type { ModelConfig } from '../model-config';
import { ModelProviderError, type ModelProvider, type ModelRequest, type ModelResponse } from '../model-provider';
import { fetchWithTimeout, providerErrorForStatus, readJson, withTransientRetry } from './provider-utils';
import { untrustedUserContent } from '../prompts';

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
};

export class GemmaGeminiProvider implements ModelProvider {
  readonly id = 'gemma-gemini' as const;

  constructor(private readonly config: Pick<ModelConfig, 'gemmaModel' | 'geminiApiKey' | 'modelTimeoutMs'>) {}

  async health() {
    if (!this.config.geminiApiKey) return { ok: false, detail: 'GEMINI_API_KEY is not configured.' };
    try {
      await withTransientRetry(async () => {
        const response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.gemmaModel)}`,
          { method: 'GET', headers: { 'x-goog-api-key': this.config.geminiApiKey! } },
          this.config.modelTimeoutMs, this.id,
        );
        if (!response.ok) throw providerErrorForStatus(response.status, 'Gemini API');
      });
      return { ok: true, detail: `Gemini API reachable for ${this.config.gemmaModel}.` };
    } catch (error) {
      const code = error instanceof ModelProviderError ? error.code : 'unavailable';
      return { ok: false, detail: `Gemini API health check failed (${code}).` };
    }
  }

  async generate(req: ModelRequest): Promise<ModelResponse> {
    if (!this.config.geminiApiKey) throw new ModelProviderError('auth', 'GEMINI_API_KEY is not configured.');
    const started = performance.now();
    const timeoutMs = req.timeoutMs ?? this.config.modelTimeoutMs;
    const userText = untrustedUserContent(req.userMessage, req.context, req.locale ?? 'en');
    const model = this.config.gemmaModel;

    const text = await withTransientRetry(async () => {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.config.geminiApiKey! },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `${req.system}\n\nYou are read-only. Never invent or present financial figures as authoritative.` }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: { maxOutputTokens: req.maxTokens ?? 512 },
          }),
        },
        timeoutMs,
        this.id,
      );
      if (!response.ok) throw providerErrorForStatus(response.status, 'Gemini API');
      const payload = await readJson(response, 'Gemini API') as GeminiPayload;
      const candidateText = payload.candidates?.[0]?.content?.parts
        ?.map((part) => typeof part.text === 'string' ? part.text : '')
        .join('').trim();
      if (!candidateText) throw new ModelProviderError('bad_response', 'Gemini API returned no text candidate.');
      return candidateText;
    });

    return { text, model, provider: this.id, latencyMs: Math.round(performance.now() - started) };
  }
}
