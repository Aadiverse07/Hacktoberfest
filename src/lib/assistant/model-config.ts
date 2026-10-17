import { z } from 'zod';

export type ModelProvider = 'mock' | 'gemma-gemini' | 'ollama';
export type DataBackend = 'mock' | 'supabase';

type ModelConfigEnv = Record<string, string | undefined>;

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url().optional(),
);
const envSchema = z.object({
  MODEL_PROVIDER: z.enum(['mock', 'gemma-gemini', 'ollama']).default('mock'),
  GEMMA_MODEL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.enum(['gemma-4-31b-it', 'gemma-4-26b-a4b-it']).default('gemma-4-26b-a4b-it'),
  ),
  GEMINI_API_KEY: optionalText,
  OLLAMA_BASE_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().url().default('http://localhost:11434'),
  ),
  OLLAMA_MODEL: optionalText,
  MODEL_TIMEOUT_MS: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().min(100).max(120_000).default(15_000),
  ),
  DATA_BACKEND: z.enum(['mock', 'supabase']).default('mock'),
  SUPABASE_URL: optionalUrl,
  SUPABASE_ANON_KEY: optionalText,
});

export type ModelConfig = {
  /** Provider requested in MODEL_PROVIDER before missing credentials are considered. */
  requestedProvider: ModelProvider;
  /** Effective provider. Missing credentials safely select mock. */
  provider: ModelProvider;
  gemmaModel: string;
  geminiApiKey?: string;
  ollamaBaseUrl: string;
  ollamaModel?: string;
  modelTimeoutMs: number;
  requestedDataBackend: DataBackend;
  dataBackend: DataBackend;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  warnings: string[];
};

/**
 * Parse model/data configuration without throwing during app startup. Invalid fields fall back to
 * their defaults, and an unavailable selected provider/backend falls back to mock with a warning.
 * Warning text contains setting names only; secret values are never logged.
 */
export function resolveModelConfig(source: ModelConfigEnv = process.env): ModelConfig {
  const warnings: string[] = [];
  const parsed = envSchema.safeParse(source);
  let values: z.infer<typeof envSchema>;

  if (parsed.success) {
    values = parsed.data;
  } else {
    const sanitized = { ...source };
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'configuration');
      warnings.push(`${key}: ${issue.message}. Its default will be used.`);
      delete sanitized[key];
    }
    // Invalid fields are removed before parsing again, so valid settings remain effective.
    values = envSchema.parse(sanitized);
  }

  const requestedProvider = values.MODEL_PROVIDER;
  let provider = requestedProvider;
  if (provider === 'gemma-gemini' && !values.GEMINI_API_KEY) {
    warnings.push('MODEL_PROVIDER=gemma-gemini requires GEMINI_API_KEY; using mock.');
    provider = 'mock';
  } else if (provider === 'ollama' && !values.OLLAMA_MODEL) {
    warnings.push('MODEL_PROVIDER=ollama requires OLLAMA_MODEL; using mock.');
    provider = 'mock';
  }

  const requestedDataBackend = values.DATA_BACKEND;
  let dataBackend = requestedDataBackend;
  if (dataBackend === 'supabase' && (!values.SUPABASE_URL || !values.SUPABASE_ANON_KEY)) {
    warnings.push('DATA_BACKEND=supabase requires SUPABASE_URL and SUPABASE_ANON_KEY; using mock.');
    dataBackend = 'mock';
  }

  for (const warning of warnings) console.warn(`[model-config] ${warning}`);

  return {
    requestedProvider,
    provider,
    gemmaModel: values.GEMMA_MODEL,
    geminiApiKey: values.GEMINI_API_KEY,
    ollamaBaseUrl: values.OLLAMA_BASE_URL.replace(/\/$/, ''),
    ollamaModel: values.OLLAMA_MODEL,
    modelTimeoutMs: values.MODEL_TIMEOUT_MS,
    requestedDataBackend,
    dataBackend,
    supabaseUrl: values.SUPABASE_URL?.replace(/\/$/, ''),
    supabaseAnonKey: values.SUPABASE_ANON_KEY,
    warnings,
  };
}
