# Training-first refinement

Implementation plan: preserve the current generator, verified library, safety checks and proposal lifecycle. Add explicit request scope with semantic intent classification and an optional UI selection; vague requests default to training. Make new proposals contain only requested components. Update atomic confirmation in an additive migration so partial revisions preserve the other component and its meal references/relational workout rows. Keep older snapshots readable.

Enrich workouts from verified exercise metadata and conservative configurable programming defaults: complete prescriptions, effort explained as repetitions in reserve, exercise-specific cues/reasons, compatible substitutions, warm-up, recovery and progression. Calculate timing from sets, repetition/hold duration, between-set rests and transitions. Treat availability as a ceiling. Check weekly movement balance, useful volume, recovery and time budgets before preview; use the existing bounded repair loop for precise feedback. Keep numerical nutrition in the deterministic calculation service.

Update preview/dashboard copy and scope-specific empty states. Add real-SQL partial-update tests and mocked-provider scope/quality/timing tests; run lint, typecheck, tests and build. No paid model calls, hosted migrations, workout logging or analytics are included in this task.

## Confirmed causes of the quality weaknesses

The previous draft schema required at least one training day and one meal, and its prompt requested equal attention for both. The homepage default prompt explicitly requested both, while the confirmation RPC unconditionally deleted/replaced both sets of child rows. There was no scope/consent boundary for partial updates. Workouts inherited a model-provided session duration; the only timing check was an exercise-count-to-minutes ratio. Prescriptions had sets/reps but no rest, effort, individual cue/reason, progression or weekly distribution checks. The library identified a lat pulldown as requiring only a generic cable machine. Preview copy exposed internal version numbers and source terminology.

## Current design

- Three scopes are resolved using a strict semantic intent response plus any explicit UI selection. Automatic/vague requests default to training. Saved dietary preferences and an existing meal plan are not consent for new meals. A UI selection takes precedence. The server embeds zero-length meals/workouts in the model schema for an unrequested component and rejects cross-scope output.
- The same existing provider, shared budgets, classification, safety and one-repair loop are used. Training-only requests do not load nutrition references or send dietary details to generation. Nutrition-only requests use the active training goal/demands but generate no new workouts. Explicit changes to days/time are constrained to saved maximum availability and explained if they exceed it. No personal measurements are needed or added to model context. Explicit current-equipment subsets constrain both candidates and alternatives; equipment outside Profile needs separate confirmation there.
- Exact exercise/equipment/experience and recipe/allergy checks remain. Lat pulldown now requires `lat-pulldown-machine`, independently of `cable-machine`. Existing cable-only preferences remain valid and are not silently expanded; earlier saved incompatible workouts show a review notice. All 48 exercise IDs/detail slugs remain.
- Complete prescriptions are derived from verified library metadata and conservative goal/experience defaults: sets/reps or holds, rest, repetitions in reserve, a movement-specific cue, reason, progression and one compatible alternative when available. Compound work is ordered before accessories. Repetitions in reserve are explained as good repetitions still possible; maximum-effort testing is not a default.
- Session timing sums warm-up (three minutes for short sessions, five otherwise), working sets × upper repetition count × a three-second repetition estimate (or hold duration), unilateral sides where applicable, rests between sets and one-minute exercise transitions. No invented conditioning is added. Totals round upward to five-minute bands and must fit the available ceiling. These are conservative estimates, not measurements or guarantees.
- New previews/saves include progression, warm-up, recovery, durations and quality notes. Goal source and saved profile goal are distinct. Profile editing is an explicit link; a changed profile invalidates the old preview. Training and nutrition goals normally match. If a user explicitly chooses a different nutrition goal, the existing training goal remains intact and both are displayed transparently.

## Deterministic programme guards

Unknown/excluded exercises, unavailable equipment, unsuitable experience, missing/changed prescriptions, empty required components and unsolicited components are rejected. Session timing is recalculated on validation, so model-written durations cannot be accepted. Missing warm-up/recovery/progression, excessive similar movement families, excessive session/direct weekly sets, inadequate session work for the time budget, poor available movement-pattern coverage and substantial repeated work on adjacent days are rejected. The bounded repair receives the precise safe rule and an actionable hint.

Defaults are a minimum of six session sets for sessions of at least thirty minutes (scaled down to four for twenty–twenty-five minutes and two for very short sessions), a maximum of twenty-four session sets, a maximum of twenty-four direct sets per primary muscle per week, and two exposures to available push/pull/knee/hip patterns for a general muscle-building programme with at least three thirty-minute days. Other general programmes use one exposure. Short or explicitly focused programmes receive limitations rather than a false claim of full-body coverage. Closely related movement families are capped at two movements per workout, or three for an explicit focused programme with at least forty-five minutes. Distinct squat/lunge/extension, hinge/bridge/abduction and rowing/rear-shoulder families are not treated as identical. Hard recovery rejection applies to substantial overlapping work on adjacent days; minor overlap is not treated as universally wrong.

These are configurable product guardrails, not a claim of one correct exercise count, optimal volume or a clinical prescription. The [ACSM 2026 position stand](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) supports regular resistance training with goal-appropriate volume and highlights substantial variation in effective programming; its [public guidance](https://acsm.org/resistance-training-guidelines-update-2026/) emphasises consistent, individualised participation. The implementation uses conservative engineering estimates for timing and does not claim the study validates its timing constants or every threshold.

Nutrition retains source-backed numerical calculations and missing-value handling. When requested, the model receives the resolved goal, active training schedule/demands and relevant explicit diet/cuisine/allergy/budget preferences. Duplicate meal names or the same source recipe repeated across slots are rejected; independent review checks qualitative variety and suitability. No calorie prescription or grocery-price guarantee is generated.

## Migration and persistence

Apply **only** `supabase/migrations/202611050002_training_first.sql` after the three existing migrations. With migration history already repaired, `supabase db push --dry-run` should list only this new migration, followed by `supabase db push`. Do not reset the database or rerun old table-creation migrations. No new credentials are required; optional programme limits have defaults. The new migration has not been applied to the hosted project in this task.

The migration adds nullable prescription/timing columns, component preference fingerprints and a zero-training-days state for a nutrition-first account. It preserves RLS/grants and replaces only the existing service-role-only atomic confirmation function. A training-only confirmation never deletes/rewrites meal ideas, references or meal items. A nutrition-only confirmation never deletes/rewrites workout days/exercises or their IDs. Revision snapshots merge the untouched component and its goal/rationale/progression. Global optimistic concurrency prevents a stale component revision from overwriting a newer confirmation. Profile timestamp/ownership/expiration checks and deletion cascades remain. Older snapshots keep their original data and are readable; they are labelled when timing/prescription details have not yet been added.

## Illustrative outputs

These are synthetic UI summaries checked through the actual deterministic enrichment code and mocked-provider tests, not claims of new live AI or hosted account verification.

| Request | Scope and output |
| --- | --- |
| “Create my workout plan” | Training only: Monday/Wednesday/Friday, about thirty minutes each for the example profile; no meals or shopping section. |
| “Help me plan my meals” | Nutrition only: varied qualitative meal ideas supporting the existing training goal; no new workouts; values unavailable without suitable source records. |
| “Create my training and nutrition plan” | Combined: the training week plus an explicitly requested varied daily meal template. Both are previewed and confirmed together. |
| “Create my personal plan” | Training only by default, with an optional invitation to add nutrition. |

For the synthetic intermediate muscle-gain profile with dumbbells/bench, three thirty-minute days, the tested sample workout is:

| Movement | Working targets | Rest | Effort |
| --- | --- | --- | --- |
| Goblet Squat | 3 × 8–12 | 90 seconds | Leave about two good repetitions possible. |
| Dumbbell Romanian Deadlift | 3 × 8–12 | 90 seconds | Same controlled effort. |
| Dumbbell Floor Press | 3 × 8–12 | 90 seconds | Same controlled effort. |
| Dumbbell Reverse Fly | 3 × 10–15 | 60 seconds | Same controlled effort. |

The calculated estimate is thirty minutes including the warm-up, working time, rests and transitions. Each movement also has its library cue, reason, progression and an equipment-compatible alternative where available. Progression builds controlled repetitions to the top of the range before a small resistance increase. This is an example fixture, not a universal programme or a personalised recommendation to the reader.

The nutrition-only example uses different lentil, chickpea and tofu meal ideas with ingredient/cross-contact review. It makes no invented nutrient or price claim. A combined example includes the same independently validated components; source-linked recipes, if available and compatible, retain deterministic totals in Nutrition.

## Changed files

New:

- `src/lib/coaching/scope.ts`: semantic intent contract, scope resolution and labels.
- `src/lib/coaching/programme.ts`: prescriptions, conservative duration calculation and configurable weekly/session checks.
- `src/lib/training/programming.ts`: explicit movement metadata for the existing library.
- `supabase/migrations/202611050002_training_first.sql`: partial confirmation and prescription persistence.
- `tests/training-first.test.mjs`: scope, consent, timing, prescriptions, quality, goals, exclusions and preview tests.
- This report.

Modified:

- `src/lib/coaching/{schema,generation,validation,workflow,service,view}.ts`: scoped schemas/context, atomic service integration, lazy nutrition data, quality/repair and legacy-compatible reads.
- `src/lib/training/{types,library}.ts`, `src/lib/coach/context.ts`: distinct pulldown equipment and conservative conversation facts.
- `src/lib/{persistence/coach-http,coach/schemas,coach/provider,coach/diagnostics}.ts`: component goal context, training-first prompts and safe diagnostic paths.
- `src/components/coaching/{PlanWorkspace,PlanPreview,DailyDashboard,HomeContent}.tsx`, `src/components/coach/CoachChat.tsx`, `src/app/nutrition/page.tsx`, `src/app/globals.css`: scope selector, user-facing copy, complete workout review, optional nutrition and explicit goal differences.
- `tests/{database,coaching-journey,coaching-plan,plan-generation-failure}.test.mjs`: real SQL/API component-preservation checks and updated model-contract fixtures; existing protections remain asserted.
- `.env.example`, `README.md`: optional guard configuration and migration/usage instructions. `.env.local` is unchanged.

## Exact manual browser steps

1. Apply the new additive migration once, restart `npm run dev`, sign in and review Profile. Confirm only equipment you really have; a cable machine alone must not enable Lat Pulldown.
2. Set a saved goal, experience, three training days and thirty minutes. Leave the selector automatic and ask “Create my workout plan”. Review the goal, schedule, calculated durations, sets/reps, rests, effort explanation, cues, reasons, progression and compatible alternatives. Confirm there is no meal/shopping/calorie section.
3. Ask “Create my personal plan” with saved dietary preferences. Confirm it still produces training only. Saved diet is not an opt-in. Try the optional nutrition invitation: it should prepare a separate request and require a new preview/confirmation.
4. Request “Help me plan my meals”, or explicitly select Nutrition only. Confirm the preview supports the current training goal and has no new workout week. Confirm it, reload Training and check that the existing workouts/prescriptions stayed unchanged.
5. With meals saved, request a workout adjustment using Training only. Confirm it and reload Nutrition. Check the existing meals, linked meal plan and quantities stayed unchanged.
6. Select Training and nutrition and request a combined plan. Confirm both sections appear and are saved only after explicit confirmation.
7. Set availability to 120 minutes, then request a sensible programme. Check it does not claim every workout takes 120 minutes; the duration shown must be the smaller calculated estimate where appropriate. Request a ten-minute session and check the preview fits the time ceiling or fails with useful repair feedback.
8. Ask to exclude a supported exercise, and check neither it nor a suggested substitution reintroduces it. Request a clearly unsafe/injury-rehabilitation plan and confirm the existing safety response/referral remains rather than invented treatment.
9. With muscle gain saved, explicitly request strength. Confirm the preview labels the requested goal and saved profile goal separately, and offers the separate Profile link. Do not expect casual chat to update Profile. If you update the profile, regenerate the preview before confirming.
10. Open two tabs, request previews from the same saved version, confirm one, then attempt the other. Expect a conflict. Change preferences while a preview is open and expect rejection. Reject or allow a preview to expire and verify it cannot be confirmed. Use another account to verify owned plan/proposal IDs are inaccessible.
11. Reload and sign out/back in. Confirm both saved components return with their data and goals. Exercise detail pages must retain How to Perform as the default and optional Equipment Setup. Progress remains an honest empty state.

## Known limitations

Scope and exclusions use semantic model classification; an explicit selector is available when ambiguity matters. Independent review is a safeguard rather than proof of clinical or programming quality. Movement metadata/volume guards are conservative heuristics, not a complete biomechanical or recovery model. Time estimates use assumed tempo/rest/transition inputs, rounded upward; actual pace and setup vary. No added conditioning is estimated because the current library has no conditioning block model. Short sessions and limited equipment may need clearly labelled coverage tradeoffs.

Older plans are preserved rather than silently upgraded. Ask Coach for a new preview to add complete timing/progression. Profile changes can invalidate a preview. Equipment beyond the saved list needs explicit Profile confirmation. New prescription fields are optional on legacy snapshots but mandatory and recomputed for newly generated training proposals.

Nutrition remains opt-in, qualitative where data is incomplete, and a repeated daily template rather than a varied weekly menu. Duplicate names/source recipes are guarded deterministically; broader similarity and cultural/medical suitability require review. There is no live grocery pricing, clinical nutrition calculator or guaranteed allergen safety. No hosted migration, live model evaluation of this new contract, full authenticated browser journey, workout logging or analytics was performed in this task.

## Verification results

- `npm run lint`: passed without warnings.
- `npm run typecheck`: passed.
- `npm test`: **169 passed, zero failed, one opt-in integration test skipped** (170 total).
- `npm run build`: passed.
- `git diff --check`: passed.
- Tests include all three scopes, vague-request defaults, opt-in nutrition/reference loading, current equipment subsets, dedicated pulldown confirmation, exclusions, complete prescriptions, duration arithmetic/ceilings, bounded quality repair, volume/balance/recovery, goal conflicts, preview rendering, actual SQL/API partial updates, first nutrition-only creation, untouched relational row IDs, ownership, expiration and stale-version/preference protection. Paid model calls are mocked.
- Work remains uncommitted on `fix/ai-plan-generation`. Hosted migration application and the manual browser/live-model checks above remain pending.
