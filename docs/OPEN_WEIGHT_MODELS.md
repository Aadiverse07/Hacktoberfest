# Open-weight models

## Gemma 4 currently configured

The default identifier is `gemma-4-26b-a4b-it`; `GEMMA_MODEL` also accepts `gemma-4-31b-it`. Google's [Gemma on the Gemini API documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) lists both exact identifiers.

Finova calls Gemma through Google's hosted Gemini API (`src/lib/assistant/providers/gemma-gemini.ts`); this is not local inference. The model weights are open-weight and can also be run locally through Ollama when a compatible model tag is installed.

## Model terms and repository license

Gemma 4's model license is [Apache License 2.0](https://ai.google.dev/gemma/docs/gemma_4_license) according to Google's model materials. The repository code separately remains under the MIT License in the root `LICENSE`. One license does not replace the other. This repository does not redistribute Gemma weights.

## Provider selection

- Offline/mock: `MODEL_PROVIDER=mock` (default; no external account required).
- Hosted Gemma: `MODEL_PROVIDER=gemma-gemini`, set `GEMINI_API_KEY`, and optionally set `GEMMA_MODEL` to one of the identifiers above.
- Local Ollama: `MODEL_PROVIDER=ollama`, set `OLLAMA_BASE_URL` and an installed `OLLAMA_MODEL`.
- `MODEL_TIMEOUT_MS` defaults to 15000. Missing credentials fall back to mock with a warning.
