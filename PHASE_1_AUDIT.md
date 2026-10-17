# Phase 1 audit — baseline and assistant backend

Repository: `Aadiverse07/Finova`, branch `main`, baseline commit `1fdd6fb` (`Fix lint errors`). This phase made no functional changes.

## 1. Baseline

Environment: Node `v24.21.0`, npm `11.19.0`.

| Command | Result |
|---|---|
| `npm ci` | Passed; installed 863 packages, generated Prisma Client 6.19.3. npm reported 25 dependency advisories (5 moderate, 15 high, 5 critical). |
| `npm test` | Failed at baseline: 22/25 test files passed; 184/186 assertions passed. Three failures: `__tests__/api/search-nl.test.ts` cannot load because its `vi.mock` factory accesses `loadWorkspace` before initialization; `__tests__/api/accounts.test.ts` expects 503 with QuikIT auth disabled but mock mode returns 200; `__tests__/unit/voice-intents.test.ts` expects `/bank?statement=1` but receives `action`. |
| `npm run typecheck` | Failed on existing TypeScript errors. Notable assistant-route errors: the 429 branches return `Response` where `OrgAuthHandler` requires `NextResponse`. Other errors occur across tests, receipt pages, bank/parser, alerts, env, PDF, voice and customer modules. |
| `npm run lint` | Passed with warnings (unused symbols, hook dependencies, `any`, and image optimization warnings). |
| `npm run dev` | Started successfully on port 3011. `/api/health`, `/`, `/dashboard`, `/reports` returned 200. `POST /api/assistant` with `{ "question": "help" }` returned 200 with a deterministic answer in mock mode. `/receipt-scanner` returned 500: `ReferenceError: window is not defined` in `src/app/receipt-scanner/page.tsx`. |

Only `.env.example` was present; no local `.env` file. Mock-mode checks needed no external accounts or keys. The app server was stopped after smoke checks. `npm run build` was not run.

## 2. Assistant backend map

| Concern | Paths | Current role |
|---|---|---|
| Assistant routes | `src/app/api/assistant/route.ts`, `src/app/api/multilingual-assistant/route.ts` | Auth wrapper, request validation, rate limiting, workspace selection, deterministic-first routing, then optional Gemini fallback. |
| Voice action audit | `src/app/api/assistant/action/route.ts` | Logs confirmed voice/action intent; does not execute financial writes. |
| Deterministic engine | `src/lib/assistant/engine.ts`, `src/lib/multilingual/assistant.ts` | Rule-based, read-only financial answers. Shared calculation/formatting helpers live in `src/lib/data/calc.ts` and `src/lib/data/format.ts`; text parsing is in `src/lib/assistant/text.ts`. |
| Gemini integration | `src/lib/assistant/gemini-brain.ts` | Server-side Gemini API fallback; sequentially tries configured keys, parses structured JSON, and returns no reply on errors/unanswerable requests. It does not run a numeric-grounding validator. |
| Workspace data | `src/lib/assistant/prisma-workspace.ts`, `src/lib/repo/`, `src/lib/data/` | In Prisma mode `loadWorkspace(orgId)` reads accounts, journal entries, invoices and expenses, all scoped to `orgId`; in mock mode the assistant route takes a shape-checked client-supplied workspace or uses empty arrays. The generic `src/lib/repo/` interface currently covers accounts only. |
| DB and configuration | `src/lib/db.ts`, `src/lib/env.ts`, `.env.example` | Prisma is lazy-loaded for `DATA_SOURCE=prisma`; `DATA_SOURCE` defaults to `mock`. Gemini keys/model/timeouts and QuikIT auth settings are env-controlled. |
| Request access controls | `src/lib/api/withOrgAuth.ts`, `src/lib/api/rateLimit.ts`, `src/lib/ai-rate-limit.ts` | Resolves the user/org (demo identity when QuikIT is disabled in mock mode), applies the AI rate limit, and wraps unexpected failures. |

### Request flow in five lines

1. The assistant client posts `{ question, language, workspace, context }` to `/api/assistant`; multilingual requests may use `/api/multilingual-assistant`.
2. `withOrgAuth` resolves QuikIT identity when enabled, otherwise permits the mock demo identity; the route applies rate limiting and validates the question.
3. In Prisma mode it calls `loadWorkspace(orgId)`; in mock mode it accepts a shape-checked browser workspace or empty arrays.
4. `answerQuestion()` / `answerMultilingual()` runs first and returns factual, in-scope answers without a model call; out-of-scope questions are refused.
5. Unresolved in-scope questions may reach Gemini when enabled and keys exist; failures fall back to the deterministic reply. Gemini receives serialized workspace records (bounded to 120,000 prompt characters) and output is not numerically validated.

### Contract note

The live assistant accepts `question`, `language`, `workspace`, and `context`, returning the common `{ success, data }` envelope with an `AssistantReply`. This differs from the build brief's proposed `message` request and extended source/provider/validation response. No contract was changed in Phase 1; discuss any change before implementing it.

## 3. QuickIt / variants audit

A tracked-file search for `quik.?it`, `quikit`, `quik it`, and `@quikit` finds **28 files**. `package.json` has no `@quikit/*` dependency. The project’s data backend is mock or Prisma, not QuickIt. Only the following files contain runtime auth/config behavior:

| File and function | Reads / writes | Relevant env vars |
|---|---|---|
| `src/lib/quikit-auth.ts` — `getQuikITIdentity()` | Reads bearer authorization/cookie; when enabled sends those headers and `INTERNAL_SECRET` to `{QUIKIT_AUTH_URL}/api/verify-token`; consumes identity/org claims. Does not read or write financial records. | `QUIKIT_AUTH_ENABLED`, `QUIKIT_AUTH_URL` (fallback `NEXT_PUBLIC_AUTH_URL`), `INTERNAL_SECRET` |
| `src/lib/api/withOrgAuth.ts` — `withOrgAuth()`, `requireAdmin()` | Calls identity resolver; passes user/org/role to route handlers. In mock mode with auth disabled, builds demo identity from `x-finova-user-id` / `x-finova-device-id`; does not persist financial data itself. Used by 28 API route declarations. | Indirectly above; mock behavior also depends on `DATA_SOURCE` |
| `src/middleware.ts` — `middleware()`, `hasSessionCookie()` | Reads session-cookie names and auth URL; redirects unauthenticated page requests only when enabled. Does not inspect financial data. | `QUIKIT_AUTH_ENABLED`, `NEXT_PUBLIC_AUTH_URL`, `QUIKIT_URL` (in documented factory example), `NEXTAUTH_URL` / `APP_URL` |
| `src/app/api/session/route.ts` — `GET()` | Calls identity resolver and returns user identity/role/provider; does not write data. | Same as `getQuikITIdentity()` |
| `src/lib/demo-auth.ts` — `useSession()` | Reads `NEXT_PUBLIC_QUIKIT_AUTH_ENABLED`; selects localStorage demo session or fetches `/api/session`. Demo login/register read and write browser localStorage; the remote mode only reads the session response. | `NEXT_PUBLIC_QUIKIT_AUTH_ENABLED` |
| `src/lib/env.ts` — `env`, `dataSource()` | Validates/reads environment; selects `mock` or `prisma`. No network or financial reads itself. | QuikIT vars below plus `DATA_SOURCE` |
| `.env.example` | Documents the env names/placeholders; no runtime behavior. `QUIKIT_CLIENT_SECRET` is empty. | `QUIKIT_AUTH_ENABLED`, `QUIKIT_AUTH_URL`, `QUIKIT_URL`, `QUIKIT_CLIENT_ID`, `QUIKIT_CLIENT_SECRET`, `NEXT_PUBLIC_QUIKIT_URL`, `NEXT_PUBLIC_QUIKIT_AUTH_ENABLED`; related auth vars `NEXT_PUBLIC_AUTH_URL`, `INTERNAL_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |

The remaining tracked matches are references, tests, or platform documentation. Their file/function and data effect are:

- `.github/workflows/ci.yml` — Node/npm CI comment; no QuickIt operation.
- `README.md` — integration and local setup documentation; no operation.
- `__tests__/api/accounts.test.ts` — test case sets auth-disabled state and asserts status; no production data access.
- `__tests__/api/helpers.ts` — test helper sets auth URL/enabled env and mocks verification; test data only.
- `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_AUDIT.md`, `docs/MULTILINGUAL_SUPPORT.md`, `docs/integration/QUIKIT_INTEGRATION.md` — integration descriptions; no operation.
- `manifest.ts`, `next.config.mjs`, `prisma/migrations/20260930000000_org_scoping/migration.sql`, `prisma/schema.prisma` — comments about platform conventions/schema; no QuickIt SDK calls.
- `src/app/about/page.tsx`, `src/app/login/page.tsx`, `src/components/login-modal.tsx`, `src/components/support-panels.tsx` — rendered copy about future/optional auth; no direct QuickIt requests or financial data access.
- `src/app/providers.tsx` — provider-order comment only.
- `src/lib/api/pagination.ts`, `src/lib/api/response.ts`, `src/lib/api/roles.ts` — local utilities with comments describing compatibility with shared conventions; no remote calls.
- `src/lib/db.ts` — Prisma client factory; comment marks a possible future replacement with `@quikit/database`, but current code imports `@prisma/client` and requires `DATABASE_URL` only in Prisma mode.
- `vitest.config.ts` — test-layout comment only.

### Recommendation: (b) disable QuickIt and default to mock

There are 28 tracked-file mentions, but they do not represent 28 active dependencies: auth logic is concentrated in a few modules, while most hits are comments/docs/UI copy/tests. QuickIt is not the current database adapter, so a QuickIt repository replacement is inapplicable. Keep `QUIKIT_AUTH_ENABLED=false` and `DATA_SOURCE=mock` for the standalone demo; retain Prisma as the existing optional backend. No implementation/removal was made in this phase.

## 4. What needs external accounts or keys

- In the verified mock setup, `/api/health`, core pages, and the deterministic assistant worked without accounts, DB, Redis, or Gemini keys.
- Gemini fallback needs one of `GEMINI_API_KEY_1`–`GEMINI_API_KEY_4` (or the legacy `NL_SEARCH_LLM_API_KEY`) and network access. With no key, it returns no model reply and the route uses the deterministic fallback.
- `DATA_SOURCE=prisma` requires `DATABASE_URL` and a reachable PostgreSQL database; writes/repository-backed data cannot run without it.
- `QUIKIT_AUTH_ENABLED=true` requires a reachable auth service, bearer/cookie session, and `INTERNAL_SECRET`; it is not needed for mock mode.
- `/receipt-scanner` currently fails under this Node runtime due to a server-render reference to `window`, even though other smoke-tested pages load.
- Build was not tested. The supplied prior audit notes Google Fonts network dependence and a `pdf.worker.min.mjs` Terser issue; these remain unverified in this run.
