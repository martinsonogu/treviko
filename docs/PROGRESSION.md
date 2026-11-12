# Intelligent workout progression coaching

## Architecture findings

Coach already loads authenticated preferences, an active plan, recent conversation and owner-scoped workout evidence, then uses the existing metered structured response generator and independent review. Plan revisions already receive that evidence through the validated proposal workflow. Workout snapshots and terminal sessions are immutable, and feedback is stored separately. These services and protections are reused.

The prior comparison only counted completed sets and maximum recorded loads. It did not classify rep/load trade-offs, find repeated exercise performances across a period, distinguish Upper B from other upper sessions, or calculate calendar training frequency. It also did not record per-dumbbell/combined/per-side conventions, so physical strength and load-volume claims cannot be established from those logs.

## Design and comparison rules

`src/lib/workouts/progression.ts` is a deterministic analysis service. It accepts bounded validated completed records, orders them by completion timestamp then UUID, and examines at most six distinct exercise identities. Each identity uses its latest performance and the nearest earlier compatible performance in the sample. Same-date sessions retain distinct IDs. An intervening incompatible unit is not silently converted into the current unit.

- Stable exercise ID is primary. Missing IDs can resolve only through an exact saved slug plus exact normalised name matching a verified library entry. Missing IDs now default to an empty identifier while reading legacy snapshots; no stored snapshot is rewritten. Similar names with different IDs are never equivalent.
- Measurement unit (reps/seconds), weighted/unweighted status, load units for weighted movements and saved slug must be compatible. kg/lb conversions are not guessed. Unexpected historical load on an unweighted snapshot remains ambiguous.
- Actual completed sets are separate from prescribed sets/ranges. Missing measurements never become zeros or target values. Partial finishes remain completed workouts and are labelled partial.
- At equal completed-set counts, unchanged paired values give recorded consistency. Increased reps/seconds at the same load, or increased load without reducing the recorded amount, can give recorded improvement. Decreases, load/rep trade-offs, changed set counts or changed self-reported effort give mixed evidence. Missing or incompatible values give insufficient evidence.
- Comparisons include actual set values, recorded amount totals/differences where valid, and available session-level effort. There are no 1RM, load-volume, calorie, muscle-growth, technique or RIR estimates. No outlier load is automatically declared correct or incorrect.
- Numeric recorded improvement is conditional on comparable entry conventions; it is not proof of physiological strength. Per-side and per-dumbbell/combined conventions were not captured. A possible small load increase is offered only conditionally after two full recorded performances reach the unchanged rep-range ceiling with manageable recorded effort. No numeric load increment is invented, and the user must confirm consistent entry/technique conventions. Missing/mixed evidence prioritises maintaining or reviewing the prescription and one material clarification.

The default observation period is 28 local calendar days including the current incomplete day. A last-month question compares the previous calendar month with the current month to date; these periods are explicitly unequal. Exact frequency is computed over all the account's completed workouts in the period, independently of an exercise/title filter. It includes partial finishes, counts multiple workouts on a date separately and counts that date once as a training day. Zero-count weeks are retained and calendar-edge/current weeks are marked incomplete. Saved weekly availability is context, not proof of a scheduled commitment or missed training. Workouts outside Treviko cannot be inferred.

## Retrieval, continuity and privacy

The new read-only `progression_workout_history` function filters by `auth.uid()` and RLS with no caller-supplied owner ID. It accepts only bounded period/filter parameters, rejects anonymous access and cross-owner anchors, and returns at most 30 completed session samples. For monthly comparisons it reserves up to 15 samples per period. The maximum query period is 93 days, selected by server code; the model never constructs SQL. Exact calendar counts remain independent of detail sampling. A truncated sample is not exhaustive historical analytics.

Explicit Upper A/B and Lower A/B questions filter the immutable saved title, including the corresponding “Body” label variant, rather than treating an entire upper-body category as one session. Chest press/bench press/curl descriptions are mapped conservatively to allowed library movements; ambiguous matches require clarification before load advice.

The server fetches feedback once for the selected sample, derives the comparisons, and supplies them as `workoutEvidence.progression`. Raw user notes and exercise notes are omitted. At most two raw session previews accompany the derived results. Serialized detail+analysis is bounded; raw previews can be removed before an oversized request is rejected. There is no logging of private records and no extra AI call. The existing token reservations include the extra JSON; daily cost/token limits and the request lease are unchanged.

The existing reference table persists up to two selected comparison IDs. Generic follow-ups retain the exercise/title/period selection from bounded user context and re-read owned pinned records; the anchor prevents newer sessions from silently changing that discussion. Explicit scope changes and corrections trigger fresh retrieval. An empty/failed newer history discussion cannot reuse an older unrelated reference. Social replies do not erase the substantive reference. Missing or stale references require clarification rather than a replacement “latest” session.

Counts, listings, greetings and unrelated questions keep their existing paths. Progression retrieval runs only after the existing authentication, scope and safety gates. The same generator and independent checker receive computed evidence; prompts require natural descriptions of uncertainty, without internal payload names or query implementation details. Plan adjustments still enter the existing proposal workflow and require explicit confirmation before persistence/activation. No logging or Progress dashboard was redesigned.

## Migration and files

Required additive migration: `supabase/migrations/202611060001_progression_history.sql`. It adds one read-only invoker function and privileges; there is no new workout storage. It has been executed in PostgreSQL/PGlite tests, **not on hosted Supabase**.

After review, the project owner can apply it through the existing migration workflow:

```sh
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
```

Inspect the linked development/production target and pending migration list first. Do not reset the database or mark unapplied migrations as applied. Contributor/local verification can use the existing local Supabase migration workflow instead.

Files changed: progression analysis/history services; Coach progression evidence, date helper, history intent/retrieval/grounding/types; persistent Coach admission context and turn references; the legacy snapshot identifier read default; regression tests; this guide and the README link. Formatting was applied only to files touched by this feature, preserving the established Prettier/hooks workflow. No tooling or dependency change was introduced.

### Changed file inventory

- Analysis and reads: `src/lib/workouts/progression.ts`, `src/lib/workouts/progression-history.ts`, `src/lib/workouts/schema.ts`.
- Coach context: `src/lib/coach/progression-evidence.ts`, `src/lib/coach/workout-dates.ts`, `src/lib/coach/workout-history-intent.ts`, `src/lib/coach/workout-history.ts`, `src/lib/coach/workout-evidence.ts`, `src/lib/coach/workout-grounding.ts`.
- Admission/reference integration: `src/lib/persistence/coach-http.ts`, `src/lib/persistence/coach-turn.ts`.
- Database: `supabase/migrations/202611060001_progression_history.sql`.
- Tests: `tests/progression.test.mjs`, `tests/coach-workout-history.test.mjs`, `tests/workout-history-queries.test.mjs`.
- Documentation: `README.md`, this guide.

### Automated verification results

Lint, typecheck, production build and formatting checks on all changed supported files passed. The full suite passed **322 tests with one opt-in local integration test skipped (323 total)**. The 17 deterministic progression tests also passed separately after adding explicit load/amount-delta assertions. Database tests execute the new read-only function in PostgreSQL/PGlite and verify cross-user anchors, RLS/anonymous denial, frequency and sample limits. Coach route/provider tests mock paid calls and verify the existing admission, reservations, independent review and pending-only proposals, including clarification on stale references.

Existing Chrome checks passed at 375px, 390px, 430px, landscape and desktop. They cover typing, errors/retry, history switching, scroll preservation and proposal review/revision/confirmation/discard with mocked transport. They do not verify this milestone against hosted workout records or a paid live model.

## Manual verification with real saved workouts

1. Apply the reviewed migration to your chosen development project. Sign in as a user with saved preferences and an active training plan. Create two distinct completed Upper B sessions on different dates (or twice on one date), keeping stable exercise IDs and the same load-entry convention. Log identifiable actual values such as 10 then 12 reps at the same load; optionally record “About right” effort for both. Keep their workout review pages available for comparison.
2. Ask “How did my last two Upper B workouts compare?” Verify the two actual saved Upper B records are selected, not Upper A/Lower B. Check set values, units, partial labels, effort and dates. No exercise should be matched merely by a similar name. Kivo should describe a recorded change and its material uncertainty, not assert proven strength or muscle growth.
3. Ask “Am I getting stronger?” and “Which exercises am I improving on?” Check that matching performances support the answer. With one session or different exercises, expect insufficient evidence. Try higher weight with fewer reps, changed sets, missing loads, a timed exercise and differing kg/lb entries; each must retain the relevant limitations rather than inventing a trend.
4. Ask “Should I increase my chest press weight?” then “What should I change next time?” Verify the specific movement, target range, actual completed sets and effort support any conditional suggestion. Compare bench press versus machine chest press separately. Missing effort or unknown per-dumbbell/per-side conventions should cause a targeted clarification when material, not a guessed numeric increment.
5. Refresh the conversation, complete a newer workout, then continue the prior discussion. It should retain its reference. Ask explicitly for a different exercise/Upper A or correct the scope; that should retrieve fresh data. Try a nonexistent/stale reference: Kivo must not substitute an older unrelated selection.
6. Ask “Have I been consistent with my training?” Verify period dates, completed count and distinct local training days against History. Include a partial finish, two sessions on one date and a week with no logs. Today/edge weeks must not be treated as complete missed targets. Ask “Am I lifting more than last month?” and check that both calendar periods contain comparable performances before any conclusion; unequal periods are not directly comparable training frequency rates.
7. Ask “Can you adjust my plan based on my progress?” Review the pending proposal and reasons. Confirm Training remains unchanged until Confirm & save; discarding must leave the active plan intact. Verify existing limits still produce the appropriate error and never cause a silent save.
8. Use a second account, an account without completed workouts, and a simulated database outage. Results must be isolated; an outage must show unavailable rather than no workouts. A greeting should not retrieve progression. Check mobile typing/error and proposal behavior at 375px/390px.

## Verification limitations

Paid OpenAI calls are mocked in automated tests. Browser fixtures use mocked authenticated transport; they do not prove real-model response quality, hosted data correctness or physical-device behavior. The opt-in local Auth/PostgREST integration check remains separate from the standard suite. No live-model verification, hosted migration, commit, push or GitHub setting change is claimed.

## Diagnostic: comparison evidence versus progress-based plan revision

A wording-dependent scope bug was reproduced before this fix. After “How did my last two Upper B workouts compare?”, “adjust my plan based on my progress” requested progression and inherited Upper B, whereas “adjust my training plan based on recent progress” set `progression=false`, cleared the reference/focus and used the legacy latest-session path. The extra word “training” missed the narrow progression phrase, and “recent” prevented contextual inheritance.

In a controlled fixture containing Upper B completions at 2026-11-05 19:17 and 19:32 Europe/London plus a newer Upper A with different movements, the latter wording selected only Upper A and supplied no structured progression. This establishes the code defect and reproduces the reported evidence shape; it does not establish the exact live model input that produced the owner's quoted sentence. No private hosted records or full provider payloads were inspected or newly logged. A persisted rationale/assistant explanation alone does not prove its historical evidence source.

The services are shared, not separate progression databases:

- Ordinary progression comparisons enter `persistentCoachHandler` → `loadWorkoutEvidence` → `loadProgressionEvidence` → `progressionHistory` → owner/RLS-scoped `progression_workout_history`, then deterministic analysis and feedback projection.
- The legacy alternative uses `queryCompletedWorkouts` (latest one when unfiltered) and `previousWorkouts` (earlier candidates). Different exercise selections can leave only that latest record. This narrow detail selection cannot establish that an Upper B pair does not exist.
- Plan proposals enter `proposePlan` through either Coach or `/api/v1/coaching/plan/proposals`. Previously, only optional admission context supplied workout evidence; the direct endpoint had no evidence retrieval, and no progression-evidence prerequisite prevented an explicitly progress-based proposal without it.
- `generatePlanProposal` passes full `workoutEvidence` into the structured draft's input and the independent checker's context when supplied. It is not intentionally reduced to a narrative summary. The previous checker did not explicitly require historical absence claims to match that evidence.

The smallest correction recognises progress/performance/history-based plan requests across revision verbs, preserves the discussed exercise/session focus unless the user explicitly broadens or changes it, and treats “recent” as a fresh read of that focus rather than a reason to discard it. An explicit all/overall/across-history request still broadens retrieval. The proposal service now reuses existing structured progression or obtains it through the same history service for direct/missing/legacy admission contexts. Pending “Go on” acceptance retains an unfulfilled progression requirement; an already produced proposal clears it. Missing relevant progression fails before generation/storage with `PROGRESSION_EVIDENCE_REQUIRED`. Independent plan review now checks historical claims and absence assertions against the same structured evidence and its coverage.

The default 28-day period covers the two reported November 5 records when requested on November 6; on that date London uses UTC. That window and the 30-record bound did not cause the controlled failure. Other explicit filters, genuinely large histories, or later observation dates can still change coverage legitimately. Existing conversation context remains bounded, so old focus outside it must be stated explicitly rather than guessed.

No change was made to confirmation, validation, active-plan publishing, ownership, migrations or existing saved revisions. The investigation is an evidence-selection issue, not an unauthorised-save issue. The prior saved revision is not automatically rewritten or rolled back.

Targeted regression coverage: `tests/progression-plan-scope.test.mjs` covers wording, focus broadening, direct-endpoint retrieval, legacy-admission repair, cached-context reuse, missing-evidence rejection and contextual acceptance. Additional Coach routing and structured-provider tests verify that the two Upper B records reach plan generation and independent review unchanged. Paid calls remain mocked.

Manual check: in the same conversation, compare the two real Upper B records, then send the exact reported “Can you adjust my training plan based on recent progress?” wording. Check the new proposal's rationale/assumptions before explicitly confirming it; the proposal must not deny the pair. Test an explicit “all recent workouts” request separately to verify legitimate broadening. Repeat through the direct proposal endpoint with your authenticated development session, then test missing/stale evidence. Do not use another account's records, expose tokens in reports or overwrite the existing confirmed plan merely to diagnose it.
