# Finova Open handoff

## Current phase and step

Phase 7 — packaging and release. **DONE**, committed as `phase 7: package and document Finova Open`. Phase 6 is committed as `e19daf6 phase 6: hardening and scope enforcement`. Phase 5 is `2f33caa phase 5: assistant orchestration and API`.

## Status

- **DONE (Phase 1):** baseline and optional external auth audit in [PHASE_1_AUDIT.md](PHASE_1_AUDIT.md); recommendation (b), mock-first and disable the optional external auth.
- **DONE (Phase 2):** typed model config, provider probe, `.env.example`, `.gitignore`; official Gemma 4 IDs documented in [PHASE_2_MODEL_ACCESS.md](PHASE_2_MODEL_ACCESS.md). Real inference succeeded with `gemma-4-26b-a4b-it`.
- **DONE (Phase 3):** assistant repository and mock contract tests; sponsor integration settings removed/disabled. Supabase deferred per Phase 1 recommendation.
- **DONE (Phase 4):** provider interface, Gemma/Ollama/mock implementations, typed errors, timeouts, transient retry and tests. Independent legacy Gemini brain retained. Commit: `00e3023 phase 4: model provider layer`.
- **DONE (Phase 5):** bounded context, safe prompts, validator, deterministic-first orchestration, one stricter retry, verified-context fallback, exact POST response contract, request validation and `/api/assistant/health`. Commit: `2f33caa phase 5: assistant orchestration and API`.
- **DONE (Phase 6):** lightweight permissive scope classifier; the requested spending pattern, saving and unpaid-invoice prompts reach the model. Clearly unrelated questions and instruction attacks are refused before provider calls; ambiguous questions get a clarification. Authenticated and Prisma requests use only the authorized repository; validated, size-capped client workspaces remain available in mock/demo mode. Request JSON is capped at 256 KB and demo workspaces at 192 KB. Existing user/device rate limit retained, with no per-IP limiter. Structured request logs omit prompts, financial records, credentials and IPs. System/provider prompt boundaries hardened; `scripts/eval.ts` covers ten real orchestrator runs including provider failure. No API response contract change and no UI changes.
- **DONE (Phase 7):** mock-first `.env.example`; generic dormant auth endpoint config and sponsor integration doc removed from public path; README, architecture, open-weight and demo docs; Gemma and repository license distinctions; clean-clone run and API smoke. No dependencies added; LICENSE preserved.

## Current work state

- **DONE:** Phases 1–7; final clone/API checks and secret scan complete.
- **IN PROGRESS:** none; no UI files changed.
- **NEXT:** manual release checklist: confirm repository visibility, review/confirm MIT project license, set production secrets only in hosting config, resolve pre-existing test/typecheck failures and verify receipt scanner runtime support.
- **Decisions:** `QUIKIT_AUTH_ENABLED=false` keeps auth dormant and preserves mock demo identity; `AUTH_SERVICE_URL` is the private auth endpoint name; mock is the no-account path; Gemma IDs remain `gemma-4-31b-it` and `gemma-4-26b-a4b-it` (default); API contract unchanged.

## Commands and current status

- `npm ci` — PASS (Phase 1).
- `MODEL_PROVIDER=mock DATA_BACKEND=mock npm run dev` — prior development smoke passed; Phase 6 route paths exercised through API tests.
- Phase 6 focused tests: `npm exec -- vitest run __tests__/unit/assistant-scope.test.ts __tests__/unit/assistant-orchestrator.test.ts __tests__/api/assistant-hardening.test.ts __tests__/api/assistant-route.test.ts __tests__/unit/assistant-validator.test.ts __tests__/unit/assistant-prompts.test.ts __tests__/unit/model-provider.test.ts --reporter=dot --cache=false` — PASS, 36/36.
- Full tests: `npm exec -- vitest run --reporter=dot --cache=false` — 30 files passed, 3 existing failing files; 224 passed, 2 failed (the full run preceded two extra passing scope cases). Existing failures: `search-nl` mock TDZ, `accounts` disabled-auth expectation, and `voice-intents` bank-statement route.
- `npm run lint` — PASS with existing warnings.
- `npm run typecheck -- --pretty false --incremental false` — FAIL with 53 existing repository diagnostics; none are in Phase 7 files.
- `MODEL_PROVIDER=mock DATA_BACKEND=mock node --import tsx scripts/eval.ts` — PASS; ten rows printed for deterministic, model, out-of-scope, and fallback paths.
- Fresh clone at Phase 7 HEAD: `cp .env.example .env`, `npm ci`, mock dev server, `GET /api/assistant/health`, factual `How much did I spend this month?`, advisory `Summarise my unpaid invoices` — all API requests returned HTTP 200; factual source `verified-data`, advisory source `open-weight-model`/mock.
- Secret scan: no high-confidence Google/GitHub/OpenAI key patterns in tracked files or branch history (18 commits, 404 unique blobs scanned). The ignored local `.env` contains a non-empty 53-character `GEMINI_API_KEY` value (redacted; not staged); `.env`, `.env.local`, and `.env.production` are ignored; `.env.example` is tracked.
- Phase 7 added no dependencies; root MIT `LICENSE` preserved. Gemma 4 model license is Apache 2.0, separately documented.
- Node/npm used: Node `v24.21.0`, npm `11.19.0`.
- `.env` is ignored. Never stage it; `.env.example` has no credentials.

## Known issues and assumptions

- The full suite has 3 pre-existing failing files: `search-nl` mock TDZ (0 tests), accounts disabled-auth expectation (1 test), and voice-intents bank statement route (1 test); latest run 30 files passed, 224 tests passed and 2 failed.
- `npm run lint` — PASS with existing warnings.
- Typecheck — FAIL with 53 pre-existing diagnostics, none in Phase 7 files.
- Mock and real-provider paths are covered. The Phase 6 evaluation used mock provider/data and did not make external inference calls.
- Figures remain sourced from deterministic repository data and validator-checked context. Model explanations are non-authoritative.
- No UI files were changed.

## Phase commits

- Phase 1: `95ef9fd phase 1: baseline and audit`
- Phase 2: `69d92e0 phase 2: model access and configuration`
- Phase 3: `f38e850 phase 3: repository layer`
- Phase 4: `00e3023 phase 4: model provider layer`
- Phase 5: `2f33caa phase 5: assistant orchestration and API`
- Phase 6: `phase 6: hardening and scope enforcement`.
- Phase 7: `phase 7: package and document Finova Open`.

## Local credential follow-up

- User supplied six Gemini credentials; local ignored `.env` now sets `MODEL_PROVIDER=gemma-gemini`, `GEMINI_ENABLED=true`, `GEMINI_API_KEY`, and rotating slots `GEMINI_API_KEY_1` through `_6`. Values are intentionally not recorded here or committed.
- Added `_5` and `_6` to the env schema and legacy sequential key rotation. Focused provider tests pass (8/8); ESLint on the changed source files passes. No live inference request was sent during this configuration step.

## Phase 8: frontend integration and Render packaging

- **DONE:** Integrated the Tradetide frontend with the Finova backend and pushed the combined repository to `Aadiverse07/Hacktoberfest` (`8b47e6a`). The outgoing history was cleaned after GitHub push protection found key-like strings in an old `.env.example` commit; the current `.env` remains ignored.
- **DONE:** Added judge overview in [Details.md](Details.md), a mock-only Render Blueprint in `render.yaml`, and a Render-compatible start command that uses `$PORT`.
- **DONE:** Mock-mode production build passes with `DATA_SOURCE=mock DATA_BACKEND=mock MODEL_PROVIDER=mock GEMINI_ENABLED=false npm run build`. Next build skips TypeScript validation because the repository has documented existing diagnostics; `npm run typecheck` remains a separate failing check.
- **IN PROGRESS:** Live Render service has not been created. Browser access to `dashboard.render.com` was declined, so work stopped before connecting the GitHub repository or creating an external service.
- **NEXT:** Open the Render Blueprint flow for `Aadiverse07/Hacktoberfest`, select `main`, and create the free `finova-open` web service. The YAML sets mock data/model and requires no secrets or database credentials.
- **Decisions:** Render demo stays on `DATA_SOURCE=mock`, `DATA_BACKEND=mock`, `MODEL_PROVIDER=mock`; real Gemini keys are not copied to Render.
