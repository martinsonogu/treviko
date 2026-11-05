# Plan-generation failure investigation and fix

## Evidence and root-cause limits

The reported message came from `proposePlan`'s catch-all: every non-`ApiError`, including provider timeouts, rejected model parameters, structured-output parsing errors and Zod failures, became `PLAN_GENERATION_FAILED` with advice to change the user's request. The provider adapter also reduced SDK parsing/HTTP errors to `PROVIDER_ERROR`. This loss of error information is confirmed in the original code and reproduced in mocked regression tests. There was no bounded repair for an invalid draft. The model-facing schema allowed arbitrary exercise/recipe strings and all equipment/experience options, even though downstream business validation accepted only a restricted set.

The exact upstream cause of the user's historical failed request cannot be recovered from the old generic message. Read-only hosted checks passed for profile parsing, active/pending plan reads, the profile timestamp guard, four food records, five recipes and the projected model input. Historical usage metadata did not retain a diagnostic that could identify this specific plan request. Do not attribute the original incident to an unsupported model, a timeout, output truncation or a particular field without evidence.

Two deliberate manual diagnostics used the actual configured `gpt-5.4-mini`, `reasoning.effort=none`, 1,800 generation-output tokens, 1,000 policy-output tokens and the existing timeouts. Both used synthetic intermediate/dumbbells-and-bench preferences and existing database-shared admission/usage controls; neither wrote profiles, plans, proposals or chat messages. The baseline succeeded (three workout days, three meals), and the updated constrained schema also succeeded (three days, three meals; scope/draft/review outputs used 46/471/35 tokens in the verification run). The original failure was **not reproduced** with the real model. These diagnostics verify structured generation and review, not the user's browser session or a hosted saved-plan round trip.

The configured model documents support for structured outputs and `none` reasoning in [official OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini). Schema design follows the [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs). The configured model, keys, budgets and timeouts were preserved.

## Changes

- `src/lib/coaching/schema.ts`: builds the model schema from exact compatible library IDs, allowed recipe IDs, saved/default experience and confirmed equipment. With no recipe records, recipe IDs must be null. Adds a response schema used by the client before showing success.
- `src/lib/coaching/generation.ts`: retains classification, safety, server validation and independent review. Allows one compact replacement attempt only for invalid/truncated drafts or repairable business-rule failures. It does not return an invalid or unreviewed proposal. Repair feedback contains safe rule names/field paths rather than raw rejected model text.
- `src/lib/coaching/validation.ts`: preserves all numeric-nutrition, credential, equipment, experience, duplicate, duration, prescription and recipe checks; identifies failed business rules for safe repair feedback.
- `src/lib/coach/provider.ts`: distinguishes timeouts, authentication, configuration, rate/quota rejection, refusals, truncation and invalid output. SDK retries remain disabled. Cancellation now bounds even an unresponsive injected transport, settles usage pessimistically and refuses already-aborted requests before admission to a paid call.
- `src/lib/coach/diagnostics.ts`, `src/lib/coaching/errors.ts`: allowlisted validation paths/codes, stage-specific public categories and server-only structured diagnostics. No raw provider errors, model text, prompts, user IDs, profiles or credentials are logged.
- `src/lib/coaching/workflow.ts`: identifies context/admission/persistence stages, removes newly created empty conversations after failed generation, and preserves the active plan. An optional chat-sync failure no longer turns a valid stored preview into a false generation failure; it returns the preview with `historySaved:false` so the UI can explain the warning without generating a duplicate preview.
- `src/app/api/v1/coaching/plan/proposals/route.ts`: logs safe request-validation diagnostics after verified authentication.
- `src/components/coaching/PlanWorkspace.tsx`: validates the returned preview before saying it is ready, retains useful public error messages and explains optional chat-sync failure.
- `tests/plan-generation-failure.test.mjs`, `tests/coaching-journey.test.mjs`: new generation/repair/error/privacy tests and actual SQL/API failure/preview/confirmation coverage.
- `README.md`: links this report and explains bounded plan repair.

No database migration, authentication/RLS change, new plan generator or environment change is required. Explicit confirmation and optimistic plan version checks remain intact. No active training or meal plan is written during proposal generation.

## Failure categories and safe diagnostics

Public errors retain `{data:null,error:{code,message}}` and private/no-store headers. Relevant categories include `PLAN_PROVIDER_TIMEOUT`, `PLAN_PROVIDER_CONFIGURATION`, `PLAN_PROVIDER_AUTH`, `PLAN_PROVIDER_RATE_LIMITED`, `PLAN_PROVIDER_REFUSAL`, `PLAN_OUTPUT_TRUNCATED`, `PLAN_OUTPUT_INVALID`, `INVALID_PROPOSAL`, `PLAN_CONFIGURATION_INVALID`, `PLAN_CONTEXT_INVALID` and the existing specific database/usage errors. Input errors still return 400, expired/unauthorised sessions remain protected and rate-limit responses retain Retry-After.

The Next.js server terminal records events such as:

```json
{"event":"coaching_plan","stage":"draft","outcome":"repairing","attempt":1,"category":"INVALID_OUTPUT","reason":"schema","issues":[{"code":"invalid_value","path":"days.0.exerciseIds.0"}]}
```

Possible stages include request, configuration, conversation, admission, profile, active_plan, nutrition, pending_proposal, input, scope, draft, validation, review, persistence, history and cleanup. Only allowlisted path names, validation codes, numeric HTTP statuses, fixed reasons and attempt numbers are emitted. Unknown property names and all rejected values are omitted/redacted.

The replacement call uses the same output cap, the same overall cancellation deadline and its own existing shared token/cost reservation. It does not reset budgets, retry provider refusals/authentication/configuration errors or bypass a failed safety review. If both attempts fail, nothing is stored as a proposal or active plan; the newly created empty chat is cleaned up. Cleanup failure is logged safely and may leave an empty chat, never a fabricated active plan.

## Automated and manual verification

Final checks: `npm run lint` passed; `npm run typecheck` passed; `npm test` completed with **154 passed, zero failed, one opt-in integration test skipped** (155 total); `npm run build` passed.

Automated tests mock OpenAI completely. Coverage includes valid generation, the exact provider enum schema, invalid JSON/schema output, unknown IDs, equipment mismatch, numeric meal claims, one-attempt repair limits, no review after final invalid output, missing preferences and nutrition data, truncated output, cancellation/timeouts, provider HTTP 400/401/429, refusal handling, redacted logs and malformed preview responses. The SQL/API journey verifies invalid request bodies perform no writes; failed generation leaves plan/proposal/meal counts unchanged, removes its empty chat and releases its lease; valid responses render the preview; confirmation persists; and optional chat failure still returns a valid, unconfirmed preview. Existing safety, ownership, concurrency and nutrition regressions remain.

Manual steps:

1. Restart `npm run dev` to load the updated server code. No SQL or environment edits are needed.
2. Sign in, review saved Profile preferences, then open Home → Create my plan (or Coach → Create or adjust my shared plan).
3. Use saved preferences and request the same personalised training/nutrition plan. Verify a workout-and-meals preview appears before any active-plan change. Where recipe data is missing, confirm that meals are qualitative and numerical nutrition is unavailable.
4. Request a change, review the replacement, then explicitly Confirm & save. Check Home, Training and Nutrition use the same saved version after reload.
5. If the original failure recurs, capture the public error category from the browser Network response and only the `coaching_plan` JSON diagnostic lines from the server terminal. Those new lines identify the failing stage; do not paste keys, cookies, full request bodies or profiles.
6. Verify a timeout/provider error leaves the saved plan intact and the form available to retry. A failed replacement must not appear as a successful preview. Recheck cross-user and stale-tab confirmation protections if deploying.

The authenticated browser journey with the user's exact failing request remains a manual verification step. The old historical error's upstream cause remains unconfirmed; no guarantee of eliminating every provider failure is claimed.
