# Phase 2 model access and configuration

## Official Gemma 4 model identifiers

Google's [Gemma documentation for the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) lists these supported Gemma 4 instruction-tuned API models:

- `gemma-4-31b-it`
- `gemma-4-26b-a4b-it`

The provider config defaults to `gemma-4-26b-a4b-it`; `GEMMA_MODEL` can select either identifier.

## Free tier and rate limits

Google's [Gemini API pricing page](https://ai.google.dev/gemini-api/docs/pricing) currently lists Gemma 4 input and output tokens as free of charge on the Free Tier, with paid-tier input/output marked unavailable. Its Gemma 4 row also says free-tier content may be used to improve Google's products; paid-tier content is not.

Google's [rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits) says limits are model- and tier-specific, measured as RPM, input TPM, and RPD; limits are per project and can change with project status. It does not publish fixed Gemma 4 free-tier RPM/TPM/RPD numbers on that page. Google directs users to the active rate-limit view in AI Studio for their project. The page says RPD resets at midnight Pacific Time.

The REST probe uses the `x-goog-api-key` header as shown in Google's [Gemini API reference](https://ai.google.dev/api/), so the API key is not placed in the URL.

## Implemented

- `src/lib/assistant/model-config.ts` validates provider/backend selection, model names, URLs, timeout, and optional credentials. Missing selected-provider credentials safely resolve to mock with a warning naming only the missing setting.
- `.env.example` documents all requested variables with mock defaults and blank credentials.
- `.gitignore` ignores `.env*` and explicitly permits `.env.example`.
- `scripts/test-model.ts` loads local Next.js env files and probes mock, Gemini REST, or Ollama; it prints provider, model, latency and response, or a sanitized error.

## Verification

- Mock probe succeeded.
- Forcing `MODEL_PROVIDER=gemma-gemini` without a key logged a warning and safely used mock.
- Invalid `MODEL_TIMEOUT_MS` logged a validation warning and used the default.
- `npm run lint` passed with existing warnings; direct ESLint also passed on both new TypeScript files. Repo typecheck still fails on 55 existing errors and reports no errors in the new files.
- Real inference succeeded against `gemma-4-26b-a4b-it` in 6,908 ms using the ignored `.env`; the prompt requested a single sentence, but the model returned a longer structured answer. The key was not committed.
