import { loadEnvConfig } from '@next/env';
import { resolveModelConfig } from '../src/lib/assistant/model-config';
import { createModelProvider } from '../src/lib/assistant/model-provider-factory';
import { ModelProviderError } from '../src/lib/assistant/model-provider';

// Load .env/.env.local with Next's own precedence rules for this standalone script.
loadEnvConfig(process.cwd());
const config = resolveModelConfig();
const provider = createModelProvider(config);

async function main() {
  try {
    const response = await provider.generate({
      system: 'Answer helpfully and briefly. Do not invent financial figures.',
      userMessage: 'In one short sentence, what is an open-weight language model?',
      context: {},
      locale: 'en',
      maxTokens: 96,
      timeoutMs: config.modelTimeoutMs,
    });
    console.log(`Provider: ${response.provider}`);
    console.log(`Model: ${response.model}`);
    console.log(`Latency: ${response.latencyMs} ms`);
    console.log(`Response: ${response.text}`);
  } catch (error) {
    if (error instanceof ModelProviderError) {
      console.error(`Model probe failed (${provider.id}): ${error.code} — ${error.message}`);
    } else {
      console.error(`Model probe failed (${provider.id}): unexpected provider error.`);
    }
    process.exitCode = 1;
  }
}

void main();
