Here's the Live link of the project: [https://finova-open.onrender.com/](https://finova-open.onrender.com/)

# Finova

Finova is a Next.js App Router and TypeScript accounting workspace. This mock-first demo starts without a database, external account, or model key.

## Finova Open assistant

Finova Open keeps financial figures in deterministic code and uses a replaceable open-weight model for language. The model sees a bounded summary, cannot perform actions, and its answer is checked against the supplied figures. Invalid output or provider failures fall back to verified context.

```mermaid
flowchart LR
  UI[UI] --> API[/api/assistant]
  API --> AUTH[Auth and rate limit]
  AUTH --> SCOPE[Scope check]
  SCOPE --> ENGINE[Deterministic engine]
  ENGINE -->|needs explanation| CONTEXT[Verified context]
  CONTEXT --> MODEL[Mock / Gemma / Ollama]
  MODEL --> VALIDATE[Validator]
  VALIDATE --> RESPONSE[Response or verified fallback]
  ENGINE -->|known answer| RESPONSE
```

See [architecture](docs/ARCHITECTURE.md), [model setup and terms](docs/OPEN_WEIGHT_MODELS.md), and the [three-minute demo](docs/DEMO_SCRIPT.md).

For judges, [Details.md](Details.md) explains the project vision, impact, architecture, demo prompts, and limitations. A mock-only Render Blueprint is included in `render.yaml`.

## Quick start (mock)

```sh
cp .env.example .env
npm install
MODEL_PROVIDER=mock DATA_BACKEND=mock npm run dev
```

Open `http://localhost:3011`. The mock path requires no accounts or credentials. Test an API request:

```sh
curl -s http://localhost:3011/api/assistant \
  -H 'content-type: application/json' \
  -d '{"message":"How much did I spend this month?"}'
```

## Enable hosted Gemma

Get an API key from Google AI Studio, keep it out of source control, then set these in ignored `.env`:

```env
MODEL_PROVIDER=gemma-gemini
GEMINI_API_KEY=your_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it
```

The provider calls Gemma through the hosted Gemini API. See [OPEN_WEIGHT_MODELS.md](docs/OPEN_WEIGHT_MODELS.md) for exact identifiers, local Ollama setup, and the separate model license.

## Checks and evaluation

```sh
npm test
npm run lint
npm run typecheck
MODEL_PROVIDER=mock DATA_BACKEND=mock node --import tsx scripts/eval.ts
```

The evaluation script runs ten prompts through the actual orchestrator and prints scope, source, provider, validation and latency.

## Environment and security

`.env.example` groups demo, optional and production-only settings. `.env*` is ignored except `.env.example`. Keep provider keys, database credentials and auth secrets in environment configuration only. External authentication is dormant by default (`QUIKIT_AUTH_ENABLED=false`); mock mode retains demo identity behavior. Production authentication needs `AUTH_SERVICE_URL`, `INTERNAL_SECRET`, and an enabled auth adapter.

## Limitations

- Supabase is not implemented; the repository factory safely uses mock data. Prisma is an optional existing data source.
- The full suite has three known pre-existing failing files documented in [HANDOFF.md](HANDOFF.md): the `search-nl` mock TDZ, the accounts disabled-auth expectation, and the voice-intents bank-statement route. The repository typecheck also has 53 pre-existing diagnostics.
- `npm run lint` may need writable `.next/cache`; generated vendored Tesseract code has existing lint findings.
- Receipt scanning has a known Node.js 21+ compatibility issue in its existing OCR path; use the project's documented supported runtime or browser OCR path.
- API-backed Gemma requires a Google API key and network access. Mock mode is the reliable offline path.

## Licenses

The application source keeps its existing root MIT `LICENSE`. Gemma 4 is separately licensed under Apache 2.0; the repository does not contain model weights. See [model licensing](docs/OPEN_WEIGHT_MODELS.md). No runtime or development dependencies were added for Finova Open phases 1–7.
