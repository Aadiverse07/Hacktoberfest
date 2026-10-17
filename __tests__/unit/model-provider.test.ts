import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveModelConfig } from '@/lib/assistant/model-config';
import { createModelProvider } from '@/lib/assistant/model-provider-factory';
import { GemmaGeminiProvider } from '@/lib/assistant/providers/gemma-gemini';
import { MockModelProvider } from '@/lib/assistant/providers/mock';
import { OllamaProvider } from '@/lib/assistant/providers/ollama';
import { ModelProviderError } from '@/lib/assistant/model-provider';

const request = { system: 'Be concise.', userMessage: 'open-weight', context: { mockKey: 'open-weight' }, timeoutMs: 100 };
const gemma = () => new GemmaGeminiProvider({
  gemmaModel: 'gemma-4-26b-a4b-it',
  geminiApiKey: 'test-only-key',
  modelTimeoutMs: 100,
});
const success = (text = 'An open-weight model shares its trained parameters.') => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text }] } }],
}), { status: 200, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('model provider factory', () => {
  it('selects providers based on typed config and falls back to mock without credentials', () => {
    expect(createModelProvider(resolveModelConfig({ MODEL_PROVIDER: 'mock' })).id).toBe('mock');
    expect(createModelProvider(resolveModelConfig({ MODEL_PROVIDER: 'gemma-gemini', GEMINI_API_KEY: 'test-only-key' })).id).toBe('gemma-gemini');
    expect(createModelProvider(resolveModelConfig({ MODEL_PROVIDER: 'gemma-gemini' })).id).toBe('mock');
    expect(createModelProvider(resolveModelConfig({ MODEL_PROVIDER: 'ollama', OLLAMA_MODEL: 'gemma4:latest' })).id).toBe('ollama');
  });
});

describe('Gemma Gemini provider', () => {
  it('generates text and returns provider/model/latency', async () => {
    const fetchMock = vi.fn().mockResolvedValue(success());
    vi.stubGlobal('fetch', fetchMock);
    const result = await gemma().generate(request);
    expect(result).toMatchObject({ text: 'An open-weight model shares its trained parameters.', model: 'gemma-4-26b-a4b-it', provider: 'gemma-gemini' });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('x-goog-api-key')).toBe('test-only-key');
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { systemInstruction?: { parts?: Array<{ text?: string }> }; contents?: Array<{ parts?: Array<{ text?: string }> }> };
    expect(sent.systemInstruction?.parts?.[0]?.text).toContain('You are read-only.');
    expect(sent.contents?.[0]?.parts?.[0]?.text).toContain('User question (untrusted data):');
  });

  it('maps auth failures without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(gemma().generate(request)).rejects.toMatchObject({ code: 'auth' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps malformed provider payloads without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not-json', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(gemma().generate(request)).rejects.toMatchObject({ code: 'bad_response' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a rate limit once, then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);
    await expect(gemma().generate(request)).resolves.toMatchObject({ provider: 'gemma-gemini' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a timeout only once and maps the final failure', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = gemma().generate({ ...request, timeoutMs: 5 });
    await expect(result).rejects.toBeInstanceOf(ModelProviderError);
    await expect(result).rejects.toMatchObject({ code: 'timeout' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('mock and Ollama providers', () => {
  it('returns deterministic keyed responses and supports invalid/throw modes', async () => {
    const provider = new MockModelProvider();
    expect((await provider.generate(request)).text).toContain('trained parameters');
    expect((await provider.generate({ ...request, context: { mockMode: 'invalid' } })).text).toContain('₹9,99,999');
    await expect(provider.generate({ ...request, context: { mockMode: 'throw' } })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('sends Ollama requests to the configured base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'gemma4:latest', message: { content: 'A model with public weights.' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OllamaProvider({ ollamaBaseUrl: 'http://localhost:11434', ollamaModel: 'gemma4:latest', modelTimeoutMs: 100 });
    await expect(provider.generate(request)).resolves.toMatchObject({ text: 'A model with public weights.', model: 'gemma4:latest', provider: 'ollama' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:11434/api/chat');
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ role: string; content: string }> };
    expect(sent.messages[0]?.role).toBe('system');
    expect(sent.messages[1]?.content).toContain('User question (untrusted data):');
  });
});
