# AI-first coaching implementation plan

Repository inspection: profiles, authenticated conversations, shared AI admission/usage RPCs, the verified exercise-ID library, recipe restrictions, deterministic nutrition calculations and private meal-plan storage can be reused. There is no workout logging or active coaching-plan schema. Progress must remain an empty state.

Implement sequentially:

1. **A — Storage and security.** Add an owner-scoped coaching-plan header, relational training days/exercises, meal-plan references and immutable proposal/revision history. A service-only atomic confirmation RPC checks proposal ownership, explicit confirmation, expiry and base version. Existing profiles and recipes remain authoritative. Account deletion cascades new records.
2. **B — Proposals.** Reuse the OpenAI Responses structured-output adapter, classification, safety, shared admission and usage budgets. Validate IDs, equipment, prescriptions, recipe restrictions and qualitative food ideas server-side. Store a pending proposal, never an active plan, until a user confirms its preview. Keep daily meal coverage explicit when source data is limited.
3. **C — Home.** Render a public landing or authenticated daily dashboard from the persisted shared plan. Respect profile timezone and ISO weekdays. Show honest no-plan, rest-day, missing-nutrition and progress states. Never generate AI on a page read.
4. **D — Training/Nutrition.** Show that same plan before preserved exercise and nutrition tools. Include instructions, scheduled days, meals, calculated totals/provenance and ingredient shopping quantities. Offer conversational adjustments with preview and confirmation.
5. **E — Conversation.** Supply the active plan to normal Coach context and add a plan conversation workflow with validated proposals, rejection and explicit confirmation. Include server-loaded recent owned chat context. Concurrent proposals cannot overwrite a newer version.
6. **F — Verification.** Exercise the actual migrations with two users in PGlite, mock all paid AI calls, test plan validation, lifecycle, shared projections and pages, then lint/typecheck/test/build. Document exact hosted migration and manual acceptance steps, with verification limits.

No hosted migration or paid AI call will run automatically. No workout logging or progress analytics are included.

## Implemented behaviour and decisions

The active plan has one owner and increasing version. `coaching_plans`, `training_plan_days`, `training_plan_exercises`, `coaching_meal_ideas` and `nutrition_plan_references` hold relational current state. `plan_proposals` stores expiring unconfirmed structured previews; `plan_revisions` stores immutable historical snapshots. The shared reader loads the snapshot belonging to the header's exact version, so concurrent publication cannot mix workout revisions. A confirmation transaction writes the header, days, exercises, daily meal references and revision together. Identical owned daily meal plans are reused, and prior saved meal plans are preserved.

The same view service powers Home, Training, Nutrition and `/api/v1/coaching/today`. It uses the profile timezone for today's weekday. Nutrients come from `recipeNutrition`; any missing meal/component makes the corresponding daily total unknown. Source-linked recipes are rechecked against current restrictions on read. The one-day shopping list contains only quantified source recipe ingredients. Qualitative ideas are not verified food records and have no invented numerical nutrition. Changed preferences show a review prompt rather than silently replacing an accepted plan.

General Coach chat receives a bounded active-plan context. The plan workspace provides the structured create/revise/cancel/confirm actions. A chat message can be passed into that workspace with its owned recent conversation. Creating another preview includes the proposal currently under review. Free-text acceptance does not automatically publish; the exact preview's confirmation button is the explicit persistent action. This deliberately keeps ordinary conversational guidance separate from authorisation to write a plan.

The implementation reuses the existing server-only Responses adapter for Zod structured outputs, as described in [official OpenAI documentation](https://developers.openai.com/api/docs/guides/structured-outputs). No model upgrade, new key, paid test call or automatic hosted migration was introduced.

## Files created and modified

Created:

- `supabase/migrations/202611050001_coaching_plans.sql`: additive schema, RLS, grants, profile timestamp guard and atomic publication RPC.
- `src/lib/coaching/{schema,service,validation,generation,workflow,preferences,today,view}.ts`: shared contracts, persistence, validation, scoped/reviewed generation, preference guards and deterministic projections.
- `src/components/coaching/{HomeContent,DailyDashboard,AccountPlan,PlanPreview,PlanWorkspace}.tsx`: public/personal Home states, connected daily plan views and explicit proposal lifecycle.
- `src/components/training/TrainingExplorer.tsx`: preserved existing client exercise tool, extracted from its page.
- `src/app/api/v1/coaching/plan/route.ts`, its `proposals`, `confirm`, `cancel` route handlers, and `src/app/api/v1/coaching/today/route.ts`.
- `tests/coaching-plan.test.mjs`, `tests/coaching-journey.test.mjs`, `tests/coaching-db-client.mjs`: mocked AI, page/projection coverage and a test-only SQL/PostgREST adapter for the actual local API/database journey.
- This report.

Modified:

- `src/app/{page,training/page,nutrition/page}.tsx`, `src/app/globals.css`: daily dashboard, preserved supporting tools and mobile layouts.
- `src/components/coach/CoachChat.tsx`: plan workspace, prompt shortcuts and passing a message/owned chat into a proposed revision.
- `src/lib/coach/{provider,schemas}.ts`, `src/lib/persistence/coach-http.ts`: shared metered structured caller and bounded active-plan context in chat.
- `src/lib/api/http.ts`: Retry-After for rate-limited private operations.
- `src/proxy.ts`: session refresh/no-store coverage for personalised Home and Training.
- `tests/database.test.mjs`, `tests/{milestone4,coach-conversation}.test.mjs`, `tests/http-smoke.mjs`: new schema/lifecycle checks and preserved legacy tests with active-plan context.
- `README.md`: setup, endpoints, behaviour and limits.

## Supabase setup

Apply **only** `202611050001_coaching_plans.sql` once after the two migrations already applied. For SQL Editor installations, run this new file as a single transaction; success returns no rows. For projects with correct CLI history, `supabase db push` applies the pending migration. Do not rerun the original table-creation migrations and do not reset a hosted database. No new credentials, Auth redirects, secret scopes or public browser write grants are required.

Nutrition reference imports remain an explicit administrative operation using the existing import script. Without imported matching recipes, previews can contain qualitative meal ideas and unknown totals. Development fallback must not be represented as comprehensive production nutrition coverage.

## Exact manual acceptance steps

1. Apply the new migration, run `npm run dev`, and open the app signed out. Confirm the public Home offers Get started and Explore exercises, with no personal data. Confirm Training and all existing exercise details remain public.
2. Sign in with a verified account. In Profile save intermediate experience, muscle gain, your actual dumbbells/common supported machines, three training days and your actual session duration. Save dietary preferences, allergies, cuisines and budget accurately; never remove an allergy to obtain a recipe match.
3. Open Home with no saved coaching plan. Confirm Create my plan and Talk to my coach appear without fictional workouts/meals or completion statistics.
4. Choose Create my plan, use saved preferences or describe your goal, and choose Propose my plan. This deliberate live generation may incur provider charges. Confirm loading feedback, a complete preview, labelled assumptions and source-linked versus qualitative meals. Confirm Home still has no active plan before acceptance.
5. Reject the proposal and verify nothing becomes active. Generate again and choose Confirm & save this plan. Open Home, Training and Nutrition. Check the same plan version, weekday schedule, exact exercise-detail links and meals; numeric totals should appear only for supported source data. Review the explicitly partial shopping list and source labels.
6. Return to Coach, open Create or adjust my shared plan, and ask “Change tomorrow's workout to legs.” Confirm the preview changes the intended day using compatible library exercises, preserves unaffected entries, and does not change the saved plan until confirmation. Confirm it, then reload all three pages and check the new version and workout.
7. Ask for an equipment substitution using only equipment actually available in Profile, and for a meal substitution consistent with your diet/allergies. Review both previews before saving. For ordinary coaching, use the normal chat; use its “Use this message to propose a plan change” action to carry the message and owned history into a plan preview.
8. Generate previews in two tabs from one base version. Confirm one, then attempt the other: expect a conflict requiring a fresh preview. Generate a preview, change Profile in another tab, then confirm: expect a preference-change rejection. No old preview should overwrite the newer plan.
9. Reload, navigate away/back, sign out and attempt private API/page access. Sign back in and confirm the plan returns. In another browser profile/account confirm no plan, proposal, meal reference or conversation from the first account is accessible.
10. Test failed/offline requests, missing AI configuration and provider timeout; errors must not report a confirmed save. Inspect no-store headers and accessible loading states. Verify actual saved timezone/rest-day behaviour. Progress must continue to show an honest empty state.

The complete live browser acceptance scenario is **not marked verified**. Local tests exercise actual SQL/API/service/rendering code with mocked Auth verification and AI output. Hosted migration application, real Supabase login/logout, actual live model quality and device/browser interaction require the steps above.

## Remaining production limits

- Meals are a daily template repeated across the week, not a varied weekly meal programme. The relational meal storage supports day slots for future expansion.
- Food/recipe coverage is small; source and allergen review remain necessary. Qualitative meals have unavailable nutrient values and no complete ingredient shopping quantities. No live grocery pricing, verified budget fit or nutritional-adequacy guarantee exists.
- Model classification and review are safeguards, not proof of safety or plan quality. Output limits may reject overly detailed requests; failures leave the saved plan intact. Perform adversarial evaluations with the deployed model.
- Plan persistence uses explicit preview confirmation. A free-text “yes” in general chat does not save a plan. Equipment not confirmed in Profile must be added there before an equipment-specific proposal can use it. Conversational disclosures never silently update permanent profiles.
- No workout logging, progress analytics, streaks or completed-workout metrics were added. No hosted deployment or paid live AI verification was performed.
- Proposals expire after a day but are retained as owned records/history until account deletion; operators should set a retention policy. Service credentials and database access remain required for paid request controls and atomic confirmation.

## Verification results

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 139 tests, **138 passed**, no failures, one opt-in local Supabase integration test skipped.
- `npm run build`: passed.
- Built-app `node tests/http-smoke.mjs`: passed public pages, protected pages, existing API boundaries and the new coaching-plan/today/proposal/confirmation/cancellation unauthenticated boundaries. No paid AI calls.
- The actual SQL migrations passed two-user RLS, atomic publication/rollback, idempotent confirmation, stale-version and preference-change rejection, cancellation, expiry and deletion tests. The local SQL/API journey passed source-linked meal reuse, workout revisions, shared rendering, fresh-client restoration, missing nutrients, changed allergies, rate limiting and origin checks with mocked Auth/AI boundaries.
- Hosted migration application, live model behaviour, hosted Auth and the complete browser end-to-end scenario remain unverified.
