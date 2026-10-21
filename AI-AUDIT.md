# AFTERLIGHT 3.0 — intelligence audit

## Before 3.0

- `src/intelligence.ts` already called OpenAI Responses through server-side fetch, requested strict JSON with an allowed action index, and fell back to authored dialogue on failures. No key was configured and no real upstream response was verified.
- The 3D UI only requested conversation when a key was configured; otherwise it ran local keyword-based demo text. Configured status was displayed as live without a completed-response distinction.
- All autonomous milestones (bread, broadcast, school preparation, evacuation), recruitment conditions, prices, trust effects and transport were authored engine rules. Character locomotion followed their authoritative location or shipment; it was not a model decision.
- Character contexts contained the six most recent memories and exposed player budgets/inventory globally. Twelve styles/private facts/goals/relationships existed, but relationships and routine were not supplied to the model.

## 3.0 boundary

The renderer, collision, resource conservation, travel time, capacity, deadlines, trust effects and storm remain deterministic engine rules. Models choose only from bounded offers produced by those rules. A request to help is distinct from a resident accepting it, and acceptance is distinct from cargo arriving.

Conversation and resident decision requests share a server-side Responses adapter. Background choices are bounded and event-driven; the UI schedules them independently from rendering. Decisions, their source mode and concise factual summaries are saved, not reconstructed through fresh calls during replay.

Missing credentials use explicitly scripted demo decisions. Failed or budget-limited provider requests use explicitly labeled fallback decisions. Configured credentials alone are never evidence of a successful live response.

## Official references checked during implementation

- [OpenAI SDK documentation](https://developers.openai.com/api/docs/libraries): reviewed; retain the project's existing direct HTTPS Responses adapter to avoid an unnecessary SDK migration.
- [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create): server-only bearer authorization, bounded output and `store:false`.
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): strict JSON schema still requires refusal/incomplete/parse-error handling.
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini): existing default supports structured outputs. Rates are configurable rather than assumed for arbitrary model names.

## Credential and verification boundary

Only project-local `.env.local`, `.env` and the inherited `OPENAI_API_KEY` were checked, without printing values. None was present. No unrelated credential store was searched. `npm run setup:ai` reads hidden terminal input and writes `.env.local` with owner-only permissions. Do not send keys in chat.

Mocked provider tests prove parser, limits and engine integration, not real model behavior. An actual upstream request requires the user's project credential and must be reported separately.
