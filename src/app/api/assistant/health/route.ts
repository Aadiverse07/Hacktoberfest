import { createModelProvider } from '@/lib/assistant/model-provider-factory';
import { resolveModelConfig } from '@/lib/assistant/model-config';

export async function GET() {
  try {
    const config = resolveModelConfig();
    const provider = createModelProvider(config);
    const health = await provider.health();
    const model = config.provider === 'gemma-gemini' ? config.gemmaModel : config.provider === 'ollama' ? config.ollamaModel ?? null : 'mock';
    return Response.json({ provider: provider.id, model, reachable: health.ok, ...(health.detail ? { detail: health.detail } : {}) }, { status: health.ok ? 200 : 503 });
  } catch {
    return Response.json({ provider: 'mock', model: 'mock', reachable: false, detail: 'Health check failed.' }, { status: 503 });
  }
}
