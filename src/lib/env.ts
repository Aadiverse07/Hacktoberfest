import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// z.coerce.boolean() treats the string "false" as true, so parse booleans explicitly.
const boolString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

/**
 * Environment contract for the standalone Finova app. Secrets are supplied only through local or deployment env.
 */
export const env = createEnv({
  server: {
    // Database (shared Postgres). Only required when DATA_SOURCE=prisma.
    DATABASE_URL: z.string().optional(),
    DATABASE_URL_DIRECT: z.string().optional(),
    DATA_SOURCE: z.enum(['mock', 'prisma']).default('mock'),
    BUSINESS_STATE: z.string().default('Madhya Pradesh'),
    ENABLE_DEMO_ROUTES: boolString,
    // NextAuth (shared session) - secret MUST match every app in the cluster.
    NEXTAUTH_SECRET: z.string().optional(),
    NEXTAUTH_URL: z.string().optional(),
    APP_URL: z.string().optional(),
    // Generic shared secret used only by the alerts digest endpoint.
    INTERNAL_SECRET: z.string().optional(),
    REDIS_URL: z.string().optional(),
    REDIS_TOKEN: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    NL_SEARCH_LLM: boolString,
    NL_SEARCH_LLM_PROVIDER: z.string().optional(),
    NL_SEARCH_LLM_API_KEY: z.string().optional(),
    NL_SEARCH_LLM_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2500),
    GEMINI_ENABLED: boolString,
    GEMINI_API_KEY_1: z.string().optional(),
    GEMINI_API_KEY_2: z.string().optional(),
    GEMINI_API_KEY_3: z.string().optional(),
    GEMINI_API_KEY_4: z.string().optional(),
    GEMINI_API_KEY_5: z.string().optional(),
    GEMINI_API_KEY_6: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    GEMINI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
    FINOVA_AI_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(8),
    FINOVA_AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
    FINOVA_PREMIUM: boolString,
    FINOVA_RECEIPT_INGEST_SECRET: z.string().optional(),
    NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),
  },
  client: {
    // Baked at image build time - changing either needs a rebuild, not a restart.
    NEXT_PUBLIC_DATA_SOURCE: z.enum(['mock', 'prisma']).default('mock'),
    NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),
    NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(8),
    NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
    NEXT_PUBLIC_FINOVA_PREMIUM: z.enum(['true', 'false']).default('false'),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_MAX: process.env.NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_MAX,
    NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_WINDOW_MS: process.env.NEXT_PUBLIC_FINOVA_AI_RATE_LIMIT_WINDOW_MS,
    NEXT_PUBLIC_FINOVA_PREMIUM: process.env.NEXT_PUBLIC_FINOVA_PREMIUM,
  },
  skipValidation: process.env.NODE_ENV === 'test',
});

/** Read directly from process.env so it also behaves under `skipValidation` (tests). */
export function dataSource(): 'mock' | 'prisma' {
  return process.env.DATA_SOURCE === 'prisma' ? 'prisma' : 'mock';
}
