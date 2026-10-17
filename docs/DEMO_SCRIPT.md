# Three-minute demo script

Use `cp .env.example .env`, then start with `npm run dev`. No external account is needed. Seed data is loaded in mock mode.

| Time | Prompt/action | Expected source |
|---|---|---|
| 0:00–0:30 | Introduce: deterministic code owns figures; the language model only explains bounded verified context. | — |
| 0:30–1:00 | Ask: “How much did I spend this month?” | `verified-data` |
| 1:00–1:30 | Ask: “Summarise my unpaid invoices” | `open-weight-model` (or verified fallback if provider unavailable) |
| 1:30–2:10 | Ask: “Explain my spending pattern and suggest ways to manage it” | `open-weight-model` (or verified fallback) |
| 2:10–2:35 | Ask: “Where can I save money?” | `open-weight-model` (or verified fallback) |
| 2:35–3:00 | Ask: “What is the weather in Mumbai?” then show the refusal and mention scope checks prevent model calls. | `verified-data` |

For a fully deterministic demo, keep `MODEL_PROVIDER=mock`; the mock provider returns canned, validated explanatory text. Verify actual badges against the API response `source` field if the configured provider has no credentials.
