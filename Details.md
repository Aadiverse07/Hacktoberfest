# Finova Open

## Project vision

Finova Open is a finance workspace that helps people understand what is happening in their business and decide what to look at next. Its vision is to make useful financial guidance understandable, multilingual, and approachable while keeping every financial figure grounded in deterministic application code.

Small businesses and individuals often have invoices, expenses, bank activity, and reports spread across different workflows. The interface brings these common tasks together, and the assistant gives people a plain-language way to ask questions about the data they are viewing.

## The problem and our approach

People should be able to ask questions such as “How much did I spend this month?”, “Where can I save money?”, or “Summarise my unpaid invoices” without trusting a language model to calculate their finances. Finova uses two clear roles:

- **Code owns the numbers.** Deterministic financial logic reads the selected repository and calculates figures.
- **The model owns the wording.** When a question needs an explanation, a replaceable provider turns a bounded summary into a short response.
- **Validation keeps the answer grounded.** The response validator rejects amounts or percentages that are not present in the supplied context, action claims, empty output, and overly long answers. On provider or validation failure, the app uses a verified fallback.

The model is read-only. It cannot write to accounts, invoices, or expenses, and its output is never treated as an authoritative calculation.

## What the project includes

- A Next.js App Router and TypeScript finance workspace with dashboard, accounts, journal, invoices, expenses, customers, banking, reports, and cash-flow forecast screens.
- Receipt scanning and OCR helpers, invoice and statement exports, alerts, and local demo data so the experience can be explored without connecting a financial account.
- A finance-focused assistant API with a deterministic-first engine, scope and injection checks, bounded context, response validation, provider health, and safe fallbacks.
- A replaceable model provider interface. Mock mode works offline; Gemma 4 can be called through Google’s hosted Gemini API; Ollama is available for a locally hosted model.
- Voice and multilingual interaction in the frontend for supported assistant and navigation workflows.

Some frontend modules currently use browser-side demo stores. The optional Prisma repository is separate; Supabase is not implemented. This is an honest, demo-ready foundation rather than a claim of production banking connectivity.

## Why this is useful and different

The practical value is not just a chat window over a spreadsheet. Finova combines a usable finance workflow with natural-language explanations while drawing a firm boundary around financial truth. The open-weight model can make the experience easier to understand, but it does not decide balances, totals, or actions. A provider can be changed without changing the deterministic calculation path.

This design supports incremental adoption: teams can begin with local demo data and a mock provider, then configure an inference provider or their authorized data source separately. The assistant’s bounded context and response checks are part of the product behavior, not merely prompt wording.

## How a request works

1. The browser sends a question to `POST /api/assistant`.
2. The route validates the request, applies the existing user/device rate limit, and checks the question’s scope.
3. The deterministic engine answers directly when it can.
4. Otherwise, a context builder selects a compact summary from the repository, with stable references and an allowlist of figures.
5. The selected provider generates language from that context.
6. A validator checks the answer. Invalid output is retried once with stricter instructions, then replaced with a verified fallback.

The response contract is `{ answer, source, provider, model, contextRefs, validation, latencyMs, limitations }`. The source identifies `verified-data`, `open-weight-model`, or `fallback`.

## Model and licensing

Gemma 4 is the primary open-weight model choice. In this project it is accessed through Google’s Gemini API, so the hosted inference request goes to Google; the project does not bundle model weights. The documented model identifiers are `gemma-4-26b-a4b-it` and `gemma-4-31b-it` ([official Gemma Gemini API documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)). The provider interface also supports mock mode and Ollama.

Gemma 4’s model terms are Apache 2.0 ([Google Gemma 4 license](https://ai.google.dev/gemma/docs/gemma_4_license)). The repository’s code has its own root MIT `LICENSE`. These are separate licenses.

## Run the demo

Requirements: Node.js 20 or newer and npm.

```sh
cp .env.example .env
npm ci
DATA_SOURCE=mock DATA_BACKEND=mock MODEL_PROVIDER=mock npm run dev
```

Open `http://localhost:3011`. This path needs no API key, external account, database, or financial account. Try these prompts:

- “How much did I spend this month?” — deterministic `verified-data` answer.
- “Summarise my unpaid invoices” — mock provider explanation or a verified fallback.
- “Explain my spending pattern and suggest ways to manage it” — mock provider explanation or a verified fallback.
- “Where can I save money?” — mock provider explanation or a verified fallback.
- “What is the weather in Mumbai?” — out-of-scope refusal before a model call.

The API health endpoint is `GET /api/assistant/health`. Run `npm test` for the existing unit and route suite, `npm run lint` for linting, and `MODEL_PROVIDER=mock DATA_BACKEND=mock node --import tsx scripts/eval.ts` for the assistant evaluation prompts.

## Limitations and next steps

- Demo-mode finance data is local/mock data; this build does not connect to bank accounts.
- Supabase support is not implemented. Prisma is optional and requires a configured database and authorized deployment environment.
- Hosted Gemma needs a Google API key in server-side environment configuration. Never put it in source control or a `NEXT_PUBLIC_` variable.
- Ollama needs a separately installed local model and a reachable Ollama server.
- Voice recognition depends on browser support and permissions. Receipt OCR has a documented Node 21+ compatibility issue.
- The repository documents pre-existing test and typecheck failures in `HANDOFF.md`; the mock demo should be verified against the current checkout before judging.

## Project links

- [Architecture](docs/ARCHITECTURE.md)
- [Open-weight models and provider switching](docs/OPEN_WEIGHT_MODELS.md)
- [Three-minute demo script](docs/DEMO_SCRIPT.md)
- [Handoff and known issues](HANDOFF.md)
