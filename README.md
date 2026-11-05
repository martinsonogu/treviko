# Treviko

Mobile-first AI personal trainer with integrated, optional nutrition coaching, built in the existing Next.js App Router repository. Milestones 1–3 remain available: 48 typed exercises, 12 muscle groups, deterministic targeting, compatible equipment filtering, accessible exercise-detail tabs, and server-side OpenAI coaching with scope/safety checks.

Milestone 4 adds Supabase-backed accounts, onboarding, private preferences, saved conversations, source-backed nutrition utilities, meal plans, account deletion and database-shared AI controls. **Supabase must be configured and the migrations applied before account features work.** Missing configuration produces a setup message or protected-route redirect; it never simulates a successful login or database save. Public Home and the exercise library work without Supabase; Progress requires sign-in.


## Kivo, your AI personal coach

Treviko is the application; Kivo is its AI personal coach. The navigation label stays **Coach**, at `/coach`, using the existing coaching APIs and shared plan system. Home, chat, training adjustments and optional nutrition guidance use this same assistant identity. A reusable forest-green/mint SVG avatar represents Kivo separately from the supplied Treviko logo.

Chat and plan generation share server-side personality instructions: practical, supportive, honest about uncertainty, clearly AI, without repetitive introductions or invented personal experience. The existing profile, context, exercise/nutrition validation, safety, usage limits and explicit confirmation rules remain in place. Historical conversations are displayed unchanged. Workout logging and progress insights are not implemented.

Manual check: sign in, open Coach and confirm the Kivo heading, labelled input and avatar. Reopen an existing chat and verify its text is unchanged. Ask a training question, preview a training-only plan and confirm no meals are added. Review and explicitly confirm a test plan, then verify Home and Training show the same saved record. Nutrition remains opt-in. Run `NAV_FIXTURE=coach npm run test:navigation` for the real Coach component and avatar in an isolated browser fixture. Automated provider tests are mocked; they do not establish live-model tone or quality.

Kivo implementation files:

- Identity and UI: `src/lib/kivo.ts`, `src/components/coach/{KivoAvatar,CoachMessage,CoachChat,CoachLoadingStatus}.tsx`, `src/app/(experience)/coach/page.tsx`, `src/app/globals.css`.
- App copy and previews: `src/components/coaching/{HomeContent,DailyDashboard,PlanPreview,PlanWorkspace}.tsx`, `src/app/(experience)/nutrition/page.tsx`.
- Shared AI personality and identity-aware instructions: `src/lib/coach/{personality,provider,scope}.ts`, `src/lib/coaching/generation.ts`. Error and guidance copy: `src/lib/coach/{http,service}.ts`, `src/lib/coaching/programme.ts`.
- Regression checks: `tests/{kivo,coach-conversation,coaching-plan,profile-save}.test.mjs`, `scripts/check-navigation-browser.mjs`. Documentation stays in this README.

## Training-first coaching experience

Home, Training, Nutrition and Coach read the same confirmed coaching record, with independently editable training and nutrition components. Workout and vague personal-plan requests default to **training only**. Meals are generated only for an explicit nutrition request or a combined selection. The Coach conversation recognises explicit requests for training, nutrition or both; no workflow selector is required. Saved dietary preferences alone never opt users into meal planning.

**Required setup:** apply the additive migration `supabase/migrations/202611050002_training_first.sql` once after the three existing migrations. With the existing migrations correctly tracked, run `supabase db push --dry-run`, check that only this file is pending, then `supabase db push`. For SQL Editor installations run only the new file as a transaction. No data reset or new credentials are needed. It adds prescription/timing columns, permits a nutrition-first record without workouts, and replaces the service-only confirmation transaction to preserve untouched components. Existing snapshots remain readable. A generic cable machine no longer implies a dedicated lat-pulldown station; confirm the new equipment option in Profile only if actually available.

On Home choose **Create my training plan**. Describe your needs in Coach, review the schedule, complete prescriptions, computed duration estimates, warm-up, effort guidance, progression and compatible alternatives, then explicitly **Confirm & save**. Nutrition can be added later, without replacing workouts. A training-only confirmation preserves existing meal references; a nutrition-only confirmation preserves existing workout rows. Global version checks still reject stale tabs, and preference changes invalidate a preview. Model text never writes to the database directly. Explicit plan requests in ordinary chat use this same preview workflow and owned history.

Session availability is a ceiling, not an invented workout duration. The server estimates time from warm-up, working sets, conservative repetition/hold duration, rest and transitions, rounding up to five-minute bands. Confirmed exercise IDs/equipment, complete prescriptions, useful volume, movement coverage, recovery and progression are checked deterministically. At most one metered repair is allowed; failed validation/review leaves the saved plan intact. Saved-profile and requested goals are displayed separately; editing the profile goal is a separate explicit action. Technical version IDs remain internal.

Source coverage is limited. When nutrition is requested, matching recipes retain deterministic nutrient calculations and provenance; otherwise meals are qualitative with numerical nutrition unavailable. The daily template can include varied meal slots but repeats across days. Shopping quantities cover known recipe ingredients only. There is no fabricated calorie target, complete nutrition-adequacy guarantee, live pricing or guaranteed allergy safety. Training-only proposals show no meal or shopping section. Existing food tools and saved meal plans remain available.

| Private endpoint | Behaviour |
| --- | --- |
| `GET /api/v1/coaching/plan` | Confirmed components and the applicable pending preview. |
| `POST /api/v1/coaching/plan/proposals` | `{message, conversationId?, scope?, goal?}`. Scope is `training_only`, `nutrition_only` or `training_and_nutrition`; omitted scope uses semantic request intent with training as the conservative default. |
| `POST /api/v1/coaching/plan/confirm` | `{proposalId, confirm:true}`; atomically replaces only the requested component(s). |
| `POST /api/v1/coaching/plan/cancel` | Reject an owned pending preview. |
| `GET /api/v1/coaching/today` | Server-authoritative daily training and optional nutrition projection. |

Verified authentication, RLS, server validation, origin checks, private/no-store responses, expiration, usage budgets, safety checks, confirmation and account-deletion cascades remain. Optional `PLAN_MIN_SESSION_SETS`, `PLAN_MAX_SESSION_SETS`, `PLAN_MAX_WEEKLY_MUSCLE_SETS` and `PLAN_PATTERN_EXPOSURES` configure conservative programming guards; defaults are documented in `.env.example`. They are quality guardrails, not universal physiological requirements. Existing `.env.local` values are preserved.

Automated tests mock paid AI and execute real SQL locally; hosted migration application, actual model quality for the new scope contract and the complete authenticated browser journey require manual verification. No workout logging or analytics were added.

## Public and account experience

Public Home and the exercise library remain available without an account. Authentication uses a compact dedicated layout; app navigation is shown only after server-verified sign-in. Signed-in members get desktop top navigation/mobile bottom navigation and a circular profile avatar linking to `/settings`. Progress requires sign-in and shows a no-history state without internal milestone labels. Public/auth/private URLs are unchanged; App Router route groups separate their layouts.

Deletion completion uses a short-lived signed HttpOnly cookie issued only after successful account removal; `deleted=true` alone never proves deletion. Browser auth cookies and in-memory credentials are cleared on the completed flow. Login preserves safe return destinations, forms have accessible show/hide controls, and signup/recovery messages remain non-enumerating. No new migration, key or Supabase setting is required for this UI work.

## Profile and settings

The authenticated header links to `/settings` through a circular, 44px avatar. Initials come only from the saved display name; missing names use a neutral person icon, distinct from Kivo's avatar. The header reads only `profiles.display_name` for the verified user and never shows their email.

Settings displays the existing saved profile and account email, grouped into personal details, training, nutrition, security, privacy/account and sign-out. All preference links reuse `/profile`. Missing values remain explicit; a profile-load failure leaves security and sign-out available. Deletion is a native keyboard-operable disclosure directly under Privacy & account and retains password reauthentication, exact confirmation and existing server-side deletion protections. Sign-out uses the existing endpoint and navigates only on confirmed success. No new account route, database, photo upload or migration is introduced.

Settings changes are in `src/components/account/{ProfileAvatar,SettingsOverview,SettingsPanel}.tsx`, `src/components/account/sign-out.ts`, `src/components/layout/ExperienceFrame.tsx`, `src/lib/profile/service.ts`, `src/app/(experience)/settings/page.tsx` and `src/app/globals.css`. Checks are in `tests/settings.test.mjs`, the existing auth regressions, and the `NAV_FIXTURE=settings npm run test:navigation` browser fixture.

Manual verification:

1. Sign in with a test account. Save a display name in `/profile`, navigate away, and verify its initials in the header. Clear the name and confirm the neutral icon appears. Check that the header contains no email and the avatar opens `/settings`.
2. At 375px and 390px, inspect the saved name, email, training and nutrition summaries. Follow each edit link, save a change, return to Settings and confirm the actual saved value appears. Existing completed onboarding must remain complete.
3. Open Privacy & account → Delete account using Enter or Space. Check the warning, labels and disabled destructive button. On a disposable test account only, verify an incorrect password fails, then use the correct password plus `DELETE MY ACCOUNT` to complete deletion and clear the session. Do not use an account with data you need.
4. Request a password reset through Security and complete it using the configured email flow. Sign out through the bottom secondary button and confirm protected pages require sign-in again. A failed sign-out must stay on Settings with an error.
5. On an installed PWA, open the keyboard in the deletion form and check input/button clearance above the bottom tabs, in portrait and landscape. Check keyboard focus for the avatar, edit links, disclosure and sign-out. Browser fixtures simulate insets; physical iPhone behaviour still needs manual verification.

## PWA navigation and branding

Authenticated navigation uses Home, Coach, Training, Nutrition and Progress in that order. Below 850px it is a persistent bottom bar; wider screens use horizontal header navigation. Nested routes select the parent destination. Public and authentication screens never show private app navigation. Safe-area insets and matching content clearance keep the bottom bar away from the home indicator and final scrolling actions.

The standalone manifest, Apple touch icon and favicon use the supplied Green Flow logo. The original artwork is preserved in `public/branding/treviko-source.png`; derived header and installation assets live in `public/branding/` and `public/icons/`. Installation requires a supported browser and HTTPS on deployed devices. No service worker or offline support is implemented.

Run `npm run test:navigation` for isolated Chrome checks at 375px, 390px, 768px, 850px and 1280px, including a simulated 34px bottom inset, keyboard focus, touch targets, active routes and content clearance. Set `CHROME_BIN` if Chrome is outside the default macOS location. These fixture-shell checks do not replace a signed-in physical-device test.

Manual verification:

1. Sign in and check each tab at 375 × 812 and 390 × 844. Open an exercise detail, use “Exercise library” to return, and verify Training stays selected. Check Coach plan review and explicit confirmation.
2. Scroll to the final controls on Training, Profile, Coach and Nutrition. Open the software keyboard on the last input, type and dismiss it. Repeat in landscape and with larger system text; check for overlap and horizontal overflow.
3. On an HTTPS deployment, use Safari → Share → Add to Home Screen on iPhone. Launch it and check the logo, session destination, notch and home-indicator spacing. Repeat on Android Chrome where available. Remove and re-add an older shortcut if its icon is cached. Connectivity is required.
4. At 850px and 1280px, confirm only desktop navigation appears. Use Tab and Enter to check focus and activation; keep browser zoom available.
5. Sign out and visit `/`, `/training`, an exercise detail and each authentication screen. Confirm private tabs are absent and exercises remain public. Verify `/coach`, `/nutrition` and `/progress` require sign-in and preserve the return destination.

## Current verification status

- Lint, TypeScript, automated regression tests and production build have been run during implementation.
- Local database tests execute the actual migrations in an embedded PostgreSQL engine (PGlite). Two distinct test users exercise RLS, ownership constraints, private messages, source-data write restrictions, shared limits, token/cost reservations and deletion cascades.
- Those tests supply a test `auth.users` table and `auth.uid()` function. **They do not establish that a hosted Supabase project's Auth, grants, email settings or migrations are configured correctly.**
- Auth/provider unit tests use mocks. An opt-in local Supabase/Auth/PostgREST/application integration test is provided, but is skipped until a local stack and keys are configured. Hosted email delivery and the complete browser journey with live AI require separate manual verification; local tests do not establish hosted configuration.
- No automated test sends a paid AI request. The USDA development snapshot was fetched from the real public source using its documented demo key; the fixture is explicitly not live data.

## Install and run

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Training: `/training`. Accounts: `/signup`, `/login`, `/forgot-password`, `/reset-password`. Private application pages: `/onboarding`, `/profile`, `/settings`, `/nutrition`, `/coach`.

**Keep your existing `.env.local` and its OpenAI key. Do not copy the example over an existing environment file.** Add the missing variables below to that file. `.env.local` is Git-ignored; only `.env.example` belongs in source control.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_ORIGIN=
USDA_FDC_API_KEY=
```

Use the project URL and **publishable** key from Supabase's Connect dialog / API Keys settings. The server secret is strictly server-only; this implementation needs it for shared budget/admission RPCs, validated assistant-message writes, administrative nutrition import and account deletion. It is never passed to client components. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable. A local stack's legacy anon key is accepted in the publishable slot; a legacy service-role key belongs only in the server secret slot. Hosted projects should use the current publishable/secret keys.

Set `APP_ORIGIN` to the application's exact origin, `http://localhost:3000` locally and your HTTPS origin in production. Restart development after environment changes; rebuild deployed bundles after changing public Supabase variables.

## Hosted Supabase setup

1. Create a dedicated Supabase project. Copy its URL, publishable key and server secret into the **existing** `.env.local`. Keep the OpenAI variables intact.
2. Install/authenticate the Supabase CLI locally. Link this repository to your project and apply the migrations:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   The original account migrations are `supabase/migrations/202611040001_milestone4.sql` and `202611040002_shared_ai_controls.sql`; coaching adds `202611050001_coaching_plans.sql` and `202611050002_training_first.sql`. A fresh project applies all four in order; an existing project applies only pending migrations. Review them before applying to any project with existing similarly named tables. They do not drop existing data. They create a profile-initialization trigger, backfill existing Auth users, establish RLS and explicitly restrict privileged RPC execution. The CLI tracks applied migrations; do not repeatedly paste them into SQL Editor. Never run a destructive database reset against a hosted project.
3. Enable email/password signups, **Confirm Email**, refresh-token rotation and appropriate password policy (the app requires at least 12 characters for new passwords). Disable anonymous Auth signups. Configure your Site URL and allow the exact `/auth/confirm`, `/auth/confirm?next=/reset-password`, and `/reset-password` URLs under your app origin. Do not use a broad wildcard for production redirects.
4. Configure confirmation and recovery email templates using the supplied HTML in `supabase/templates/`. Confirmation uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`; recovery uses the same path with `type=recovery`. The route verifies the token server-side and permits only safe internal redirects. PKCE code callbacks are also supported.
5. Configure production SMTP and review Supabase's Auth rate limits and bot protection. Default hosted mail delivery is limited and must not be assumed to be production-ready.
6. Register a test account in `/signup`, open its confirmation email, log in, complete onboarding and reload `/profile` to verify persistence. Test recovery through a real email link. Test logout and session expiry. Use two separate browser profiles/accounts to check that profiles, conversation IDs and meal-plan IDs do not cross user boundaries.

The implementation follows [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [current API key naming](https://supabase.com/docs/guides/getting-started/api-keys). Proxy refreshes cookies; every protected API independently verifies the user via Auth `getUser`, not an unverified cookie/session or browser-supplied ID. Browser auth uses server-managed HttpOnly, SameSite cookies (Secure in production). Identity changes use a fresh document navigation to discard the previous account’s in-memory UI. Future native clients can authenticate with Supabase's SDK and send their access token as `Authorization: Bearer …` to the same APIs; they do not need browser cookies.

## Local Supabase alternative

The repository includes `supabase/config.toml`, confirmation/recovery templates and an intentionally empty seed file. Run Docker first, then:

```sh
supabase start
supabase migration up --local
```

Copy the local project URL, publishable/anon key and server secret/service-role key from the local CLI/Studio into `.env.local`, without overwriting the existing OpenAI settings. The default local app origin is `http://localhost:3000`. Local Auth is configured to require confirmation; use the local mail inbox reported by `supabase start` for signup/recovery links. No paid external infrastructure is required for this local alternative.

For a disposable local database only, `supabase db reset --local` reapplies migrations but **deletes local data**. It is not required during normal application use. Never use reset on a project containing data you want to retain.

## Profiles and onboarding

Seven mobile-friendly stages cover goals, experience, training space, schedule, food preferences, optional measurements and review. Next/back/step navigation saves progress through the API. A failed save retains the form and shows an error. Weight, height, age, equipment and experience are optional; public training and basic browsing do not depend on body measurements. Equipment distinguishes **unknown** (`null`) from confirmed bodyweight-only (`[]`). Body measurements are stored in canonical centimetres/kilograms with UI conversion for imperial preferences.

Important preferences use structured columns across `profiles`, `user_fitness_preferences` and `user_nutrition_preferences`. Partial updates remove Zod defaults so changing a display name cannot silently reset allergies or equipment. An invoker-security transaction updates only the verified user's rows. Profiles are never returned publicly.

Coach loads saved goals, experience, equipment, diet, cuisines, dislikes, allergies and budget. Adult age, height, weight, display name, timezone and other unrelated profile data are not sent to OpenAI. An under-18 age is translated only into the safety signal needed to avoid inappropriate coaching. The classifier receives no full profile; safety fast paths inspect context first, and generation gets a topic-specific subset. Temporary chat preferences cannot erase saved allergy or minor-related disclosures. Profiles/messages remain untrusted data and cannot override scope rules.

## Nutrition provenance and calculations

[USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) is the source adapter. The source publishes data under CC0 and requests attribution; the UI and stored records retain USDA source IDs, direct record URLs, license, data type, preparation state and retrieval time. A server `USDA_FDC_API_KEY` is required for live search/detail calls. Keys are passed in a header, not included in logged URLs.

The adapter accepts Foundation, SR Legacy and FNDDS details, not arbitrary branded serving labels. It maps **only** these per-100-gram definitions:

| Field | FDC nutrient ID | Unit |
| --- | --- | --- |
| Energy | 1008 | kcal |
| Protein | 1003 | g |
| Carbohydrate by difference | 1005 | g |
| Total lipid (fat) | 1004 | g |

Other energy definitions (for example alternate Atwater values) are not silently substituted. Missing values remain `null`/Unknown; they are never filled with zero or invented by an LLM. Duplicate definitions and incompatible units fail validation.

`gramsFor`, `servingNutrition` and `recipeNutrition` are reusable deterministic utilities. They handle g/kg, source-defined serving mass, and ml/l **only when an explicit food density is available**. No default of 1 ml = 1 g is used. Recipes retain exact ingredient food IDs and masses; raw and cooked records are not interchanged or assigned assumed cooking yields. Totals and per-serving values are calculated from the listed records, displayed with limited precision, and labelled calculations rather than new laboratory measurements. Missing any component nutrient makes that total unknown. Additions, seasonings, preparation and source variability affect results.

Chat does not receive food records and therefore provides **qualitative nutrition advice only**. Main prompts, a numeric-nutrient guard and output review block model-generated calorie/macro/protein-target numbers. Source-backed numeric browsing and totals belong in Nutrition, not invented AI prose. No personal calorie-deficit or medical nutrition calculator was added.

### Development data and import

`src/lib/nutrition/fdc-fixture.json` contains four actual captured USDA SR Legacy records: cooked rice (168878), cooked lentils (172421), cooked black beans (173735) and cooked cowpeas (173759). They are explicitly labelled development snapshots, not verified live data. Five minimal, authored rice/pulse recipe examples cover broader African, Indian, Middle Eastern, Latin American and Mediterranean contexts. They are **not verified traditional recipes** or a fabricated large recipe database. Broader cuisine matches stay labelled as examples, not exact cultural matches.

When no records are imported, development can show these fixtures. `NUTRITION_ALLOW_FIXTURES=true` explicitly permits them in other environments; set it to `false` for a production experience without development fallbacks. Import the small reference set before saving plans that reference its recipes:

```sh
# Explicit administrative operation against the project configured in .env.local:
npm run nutrition:import -- --apply

# Fetch fresh USDA records first; requires USDA_FDC_API_KEY:
npm run nutrition:import -- --apply --live
```

The first command preserves fixture provenance and marks no food verified live. The second validates fresh USDA records and stores source provenance; recipe examples remain development recipes. Import is a deliberate server/admin operation, never a browser write capability. Do not mark allergen status reviewed without actually reviewing ingredient sourcing, labels and cross-contact information.

`scripts/fetch-fdc-fixture.py` can deliberately refresh the four snapshot records with USDA's published demo key. The public demo key has low request quotas and is not used for application production traffic. Live source values were not fetched using a private key during implementation; integration still needs your source setup.

### Meal selection and safety

The deterministic recommendation API uses saved dietary patterns, cuisines, dislikes and allergies, plus requested ingredients, protein ranking, preparation time and result count. Dietary certification such as halal/kosher is never inferred from ingredients; a recipe must explicitly support the pattern. Unknown allergen status excludes a recipe when any allergy is declared; custom allergy notes fail closed for automated recipes. This small unreviewed fixture therefore often returns no recipe for allergy-restricted users. Do not remove a real allergy just to obtain a match.

Cuisines are explicitly selected by the user, never inferred from identity. Current budget information is stored and can inform qualitative chat, but **no live pricing database exists**, no exact grocery price is fabricated, and deterministic meal selection does not claim budget fit. Inspect all labels and cross-contact risks; no absolute allergen-safety guarantee is made.

## Conversation-first Coach

The previous screen put a separate plan generator, preferences and saved-history controls ahead of chat. `/coach` now opens a compact Kivo header, one message scroller and a persistent composer above the mobile tabs. History and temporary settings/privacy use labelled native dialogs with keyboard dismissal and focus management. Technical connection details live in the settings dialog. When the software keyboard reduces the visual viewport, the mobile tabs and compact conversation header temporarily hide so the composer has room; they return when the keyboard closes. Existing deep links prefill the same composer; they do not make a paid request until Send is pressed.

The existing `POST /api/v1/coach/messages` accepts optional `conversationFirst: true` and an owned `proposalId` for a selected preview. It uses metered structured intent classification within the existing shared request lease. Advice (including bulking, recovery and workout explanations) remains a normal response. Explicit creation, active-plan changes and substitutions reuse `proposePlan`; requesting meals is required for nutrition proposals. A revision can target an unconfirmed preview. A bare “yes” or “save it” never publishes anything. Chat classification receives only goals/experience and minimal plan/preview metadata; detailed restrictions and validated data stay in the existing topic-specific generation pipeline.

Proposals appear inline, with goal/experience/timing/equipment summaries, collapsed workout days, rest and substitution options, and confirmation actions before detailed instructions. “Request changes” focuses the composer with the preview selected; it does not send automatically. `Confirm & save` and rejection still use the existing APIs, ownership checks, preference fingerprints, version checks and expiry rules. Saved preferences are never overwritten by chat. One lease covers routing and generation; model output cannot authorise publication. A plan request adds one metered routing classification before the existing plan generation/review stages, within the same token and cost controls.

The additive read-only `GET /api/v1/coaching/plan/proposals/:id` restores owned proposal cards alongside unchanged saved messages, including confirmed, rejected or expired snapshots. The last five references hydrate automatically; older references load on demand. A missing old proposal leaves the original conversation data intact and offers a useful error. Existing clients that omit `conversationFirst` retain the original message response contract. No database migration or parallel generator is introduced.

Changed implementation files: `src/components/coach/{CoachChat,CoachDialog,InlineProposal}.tsx`, `src/components/coach/{conversation-state,viewport}.ts`, `src/lib/coach/{action-intent,provider}.ts`, `src/lib/persistence/coach-http.ts`, `src/lib/coaching/{workflow,schema,generation,proposal-reference}.ts`, the proposal retrieval route and `src/app/globals.css`. Regression and browser support live in `tests/conversation-first.test.mjs`, `tests/coaching-plan.test.mjs`, `tests/conversation-fixture.mjs`, `tests/app-router-fixture.mjs`, `tests/kivo.test.mjs` and `scripts/check-navigation-browser.mjs`.

Manual verification:

1. Sign in on `/coach` at 375px, 390px and 430px. Confirm the composer is available immediately, history/settings are secondary and messages scroll independently without horizontal overflow. Type several lines, open/dismiss the software keyboard and check the composer stays visible. Repeat in an installed iPhone PWA, landscape and desktop. Enter adds lines; Ctrl/⌘ + Enter sends.
2. Ask “How best can I bulk given my weight and height?” and a recovery or workout-explanation question. Expect conversational guidance, without a plan being generated or saved. Then send “Create a two-day muscle-building programme.” Review the inline preview, expand workout details and verify no meals appear.
3. Request a substitution in a saved plan or choose “Request changes” on an unconfirmed preview. Send the revision through the same composer. Verify the existing active plan stays unchanged until `Confirm & save` succeeds; then check Home and Training. Check that a different requested goal leaves the saved Profile goal intact.
4. Explicitly request a meal plan. Check dietary restrictions and existing training context. Numerical nutrition remains source-backed; absent data is unavailable, not estimated. Reject a proposal and verify the saved plan stays intact. Check expired/stale previews are rejected by the server.
5. Open History using the keyboard, start a new chat, resume an old one, rename it and reload. Confirm text and proposal statuses survive reopening. Check another test account cannot retrieve the conversation or proposal ID. Ask an out-of-scope or safety-sensitive question and verify policy handling.
6. In Settings, check temporary preference labels, saved Profile link, privacy/safety information and connection diagnostics. Run `NAV_FIXTURE=coach npm run test:navigation` for isolated responsive/keyboard checks; browser fixtures simulate viewport and keyboard sizing without live accounts or paid AI.

Remaining verification: live-model intent/tone quality, hosted email/auth configuration and physical-device iOS keyboard/pan behaviour need manual testing. Automated tests mock paid calls. No workout logging, progress analytics or native app is included.

## Kivo typing status

Pending chat requests use the existing generating/busy state to render one transient assistant bubble below the latest user message, with Kivo's avatar and three gently staggered dots. The bubble is not appended to saved entries or sent in API payloads. Completion, error, timeout and cancellation remove it. The separate accessible status announces the label once; decorative dots do not produce repeated screen-reader announcements, and reduced-motion preferences disable the animation.

Known UI actions (such as the training/meal-plan suggestion chips or a proposal change action) can show a preparation label. Edited/free-text requests use “Kivo is typing” because the client cannot know server-side intent before the response; no progress stages are invented. Scrolling follows new content only while the user is following the conversation, including viewport/composer resizes. Reading older messages does not force a jump to the bottom.

Changes are limited to `src/components/coach/{KivoTypingIndicator,CoachChat,CoachLoadingStatus}.tsx`, `src/components/coach/conversation-scroll.ts`, styles and test/documentation support. AI routing, budgets, plan generation, confirmation and Supabase writes are unchanged.

Run `npm run test:typing` for the actual Coach client in isolated Chrome with all API calls replaced by an in-memory test transport. It covers 375px/390px/430px/desktop placement, reduced motion, normal replies, workout/meal labels, failure, timeout, retry, cancellation, history switching, unchanged payloads and intentional scroll-up. The script uses the installed Next.js compiler dependencies, creates only temporary fixture files, and makes no real API or AI requests. Set `CHROME_BIN` if Chrome is outside its default macOS path.

Manual check on an authenticated device: send a normal question and verify the bubble appears immediately below your message and becomes the reply. Repeat using training/meal suggestions, then a failed request and retry. Open History and start a new conversation while waiting; confirm no old indicator survives. Scroll up while awaiting a reply and verify your reading position remains. Check with reduced motion enabled and an on-screen keyboard in an installed PWA; actual iOS keyboard and screen-reader behaviour still need physical-device verification.

## Contextual plan follow-through

Confirmed cause of repeated plan offers: the old action contract required an explicit request in the current message and explicitly classified bare acceptance as conversation. It tracked no outstanding offer/clarification, and the plan pipeline resolved availability primarily from the current turn and saved profile. Thus “go on” after an offer could repeatedly reach chat instead of executing the proposal workflow; conversation-only availability never became validated plan context.

The server now reconstructs bounded task context from the current account's owned recent history (up to 10 messages/12000 characters). Semantic structured routing identifies a relevant continuation source; narrow clear-request/acceptance guards and conservatively sourced USER facts ensure the reported weekly-workout request advances even when the action classifier otherwise returns conversation. Normal explanations, recovery questions, unsafe/unrelated requests and continuation without an outstanding task do not trigger a new plan. An existing preview is re-shown for review, not implicitly confirmed or repeatedly regenerated. Rejected/expired previews never become active from chat acceptance.

When essential equipment or training availability is absent, Kivo asks one focused question, persists that conversational turn and resumes when the user answers. Explicit “twice a week”, equipment answers and other confirmed user details guide the same generator. Beginner targets and a thirty-minute ceiling remain labelled conservative starting options if experience/time are unspecified. Current explicit goals take precedence over older conversation goals, which stay separate from saved Profile goals.

Server-attached `conversationPreferences` in the existing proposal/revision JSON snapshot records plan-specific confirmed equipment, days, time or experience. The AI draft schema cannot write this metadata. Saved Profile rows and their confirmation fingerprints remain unchanged. Generation, confirmation and daily-plan compatibility checks apply the same validated context. Existing saved equipment restrictions, maximum availability, experience limits, dietary constraints, expiry and version checks remain enforced. No database migration is required; the real-SQL journey verifies that snapshot context survives explicit confirmation and partial meal revisions.

Changed files: `src/lib/coach/{task-context,context,action-intent,provider}.ts`, `src/lib/persistence/coach-http.ts`, `src/lib/coaching/{conversation-preferences,schema,generation,workflow,validation,view}.ts`, `src/lib/api/http.ts`, and the contextual notes in `src/components/{coach/InlineProposal,coaching/PlanPreview}.tsx`. Regressions are in `tests/followthrough.test.mjs`, `tests/coaching-plan.test.mjs`, `tests/coaching-journey.test.mjs` and the existing conversation fixtures/checks.

Manual live-model verification (automated calls remain mocked):

1. Restart/redeploy the updated app and reload Coach. With a test profile containing confirmed equipment and two training days, send “How can I build muscle?” If Kivo offers a plan, reply “go on”. Expect an inline, validated training-only preview. Then send “I am 83kg, 178cm. I want a planned weekly workout.” Expect a proposal without another generic offer.
2. Reply “go on” repeatedly to a pending preview. Check that its proposal ID stays the same, no new generation occurs and the active plan/version stays unchanged. Only `Confirm & save` may activate it. Then verify Home and Training show the confirmed plan.
3. In a test account with missing equipment/days, ask for a weekly workout. Answer the equipment question (“Dumbbells” or “Bodyweight only”), then “Only twice a week” if asked about availability. Expect one question at a time and a preview as soon as the essentials are known. Verify Settings/Profile values remain unchanged; the plan identifies conversation-specific details.
4. Try “Yes, create it”, “Make me a 2-day workout plan”, “Change the second workout”, and “Use dumbbells instead” in relevant context. Verify existing equipment/time/day ceilings and profile-goal distinctions. Ask “What is progressive overload?” and “How should I recover?”; these should remain explanations.
5. Explicitly request meals to test nutrition opt-in. Reject a preview or let one expire, then continue: it must not be silently saved. Use a second account to verify conversation/proposal IDs remain inaccessible, and verify rapid duplicate submissions cannot publish or generate concurrent plans.
6. Repeat the conversation at 375px, 390px and 430px and in an installed PWA. Check the composer, software keyboard, context notes, previews and confirmation. `NAV_FIXTURE=coach npm run test:navigation` provides isolated layout checks; hosted-model quality and physical iPhone keyboard behaviour still require these live checks.

Task memory is deliberately bounded to the owned recent conversation; an old task outside that window may need to be restated. Novel phrasing still depends on the configured semantic classifier and review. The tests do not certify real-model behaviour or a hosted deployment.

## Coach conversation behaviour

Greetings, introductions, experience/body-measurement statements and coaching follow-ups are in scope. Semantic safety/injection checks run before narrowly defined conversational recovery. The model receives explicit saved/provided preferences separately from sourced facts mentioned by the user in the current conversation; assistant guesses are not user facts. No inferred conversation details are automatically written to Profile. Missing equipment can limit exercise cards without blocking useful general coaching.

The active conversation is restored from its URL UUID through the authenticated API. Start fresh conversation clears that UUID and starts new context; old saved chats remain selectable. Failed optimistic bubbles are removed and wrong/stale-conversation replies are ignored. Reload saved chat reconciles uncertain network results before retrying.

Tests mock all paid provider calls. Source and safety instructions remain separate from untrusted context, following [official OpenAI prompting guidance](https://developers.openai.com/api/docs/guides/prompt-engineering).

## Saved conversations and meal plans

Conversations can be created, reopened, renamed, deleted or started fresh. Successful validated responses and their user messages are committed together. Errors/timeouts are not saved as successful replies. Only the server may append assistant messages. A conversation holds up to 500 messages; the AI receives at most the latest 10 and 12000 characters. Browser-supplied history/ownership fields are rejected by the persistent endpoint. Common credential-like strings are rejected in chat/title/profile API input; never deliberately submit secrets.

Reset starts a fresh conversation without deleting previous saved chats. Deleting a conversation cascades its messages. Exercise cards use exact library IDs and existing detail pages; placeholders and the default **How to Perform** tab are preserved.

Meal plans reference stored recipe IDs and serving/slot quantities. The server checks current saved restrictions again when saving. Plans may be listed and deleted. Recipe imports must be present in Supabase before their IDs can be saved; a failed import/save never produces a success message.

## Shared access controls and privacy

The live `/api/v1/coach/messages` route **always requires a verified, email-confirmed, non-anonymous Supabase user**, including development. The old `COACH_ALLOW_ANONYMOUS` setting applies only to a retained legacy unit-test adapter and cannot enable anonymous paid access. `/api/v1/coach` remains a clearly labelled deterministic legacy demo and never calls OpenAI.

Paid request admission uses transactional PostgreSQL RPCs with a global admission lock, per-user/global minute buckets, one active request per user/conversation, global concurrency and expiring leases. Per-stage token and optional USD reservations are shared across server instances; no paid request falls back to process-local counters. Missing controls fail closed. Provider retries are disabled, per-call/overall timeouts and bounded JSON bodies remain, and 429 responses include `Retry-After`.

Usage reservations are charged pessimistically before each call and reconciled with returned token usage. Timeouts/unknown usage retain the reservation. Current operator-supplied model prices are required to enable USD caps; blank prices mean unknown costs, not zero or an invented price. The estimates count cached input at the full input price and are guards, not authoritative billing. Configure upstream OpenAI project spend limits as well.

Usage rows contain ownership, stage/model, counts/cost estimates and status, not prompts or health notes. No application request/credential diagnostics are logged. All private JSON uses `Cache-Control: private, no-store`; Proxy preserves refreshed session cookies/cache headers. Origin checks defend browser mutations, while verified bearer/cookie authentication and RLS enforce ownership. Spoofable forwarding or user-ID headers are not trusted; Supabase Auth's IP-based limits and deployment-level abuse protection should be configured rather than inventing an IP identity from arbitrary headers.

Account deletion requires the exact confirmation text plus a newly verified current password. The server deletes only the authenticated user's Auth record; foreign keys remove private profiles, preferences, conversations, messages, meal plans, leases, user budget/usage rows, and a trigger clears transient user rate buckets. Non-identifying global aggregates can remain. Deleting current rows does not erase provider backups, hosting logs, emails or previously sent AI-provider data; those follow their own retention policies. `store:false` on OpenAI responses does not promise zero provider retention.

## AI quota diagnosis and controlled development testing

Paid Coach uses database-shared admission and budgets, including when running `next dev`. `reserve_ai_usage` checks the per-user and global UTC-day buckets in `ai_budgets` against the next stage's full reservation, not just completed usage. The reservation intentionally uses UTF-8 prompt/context/schema bytes plus output allowance and overhead as a conservative bound. `settle_ai_usage` replaces that reservation with known provider token usage; unknown usage remains conservatively charged. A rejected reservation rolls back and does not add a usage event. Remaining allowance below the next reservation can legitimately block a call even when the counter is below the daily cap.

`TOKEN_BUDGET` and `COST_BUDGET` identify daily limits; `RATE_LIMITED` identifies minute admission and `BUSY` identifies concurrency. Application responses preserve those codes. Daily errors and Retry-After point to the next midnight UTC; minute/concurrency responses no longer masquerade as a daily token budget. SQL errors currently do not identify whether the user or global bucket rejected a reservation: an authorised read-only audit of both counters and configured limits is needed to distinguish scope.

Audit only aggregate budget/event fields, never credentials or conversation text. For a UTC day, reconcile each surviving user's `ai_budgets.tokens` with `coalesce(input_tokens,reserved_input)+coalesce(output_tokens,reserved_output)` across that user's `usage_events`. Inspect uncompleted events and leases before attributing unknown usage to a bug. Global aggregates can exceed retained user events after account deletion: user-scoped events/budgets cascade away, while non-identifying global usage intentionally remains. Never erase legitimate history or refund unknown usage simply to unblock testing. Dollar counters are not proof of zero spend when prices are unset: cost is unknown and USD caps cannot be enabled without configured prices.

For live development testing, use separate Supabase and OpenAI development projects/credentials, isolated from production users and counters. Keep production configuration unchanged. A controlled single-developer example for that isolated environment is:

```dotenv
COACH_DAILY_TOKEN_LIMIT=100000
COACH_GLOBAL_DAILY_TOKEN_LIMIT=100000
COACH_REQUESTS_PER_MINUTE=2
COACH_GLOBAL_REQUESTS_PER_MINUTE=4
COACH_MAX_CONCURRENT=1
COACH_DAILY_COST_USD=0.50
COACH_GLOBAL_DAILY_COST_USD=0.50
# Set these to current prices for the actual configured development model:
OPENAI_INPUT_PRICE_PER_MILLION=
OPENAI_OUTPUT_PRICE_PER_MILLION=
```

Fill both price fields before enabling the example USD caps; missing pricing fails closed. These are application estimates, not a guarantee about the provider invoice or other uses of a key. Monitor provider billing too. Run one bounded conversation/plan scenario at a time with existing output/time limits and inspect settled events after each. If the daily allowance cannot cover another reservation, wait for UTC reset or stop that day's test; do not switch production accounts or clear its counters. Simply setting `NODE_ENV=development` does not isolate quotas.

Quota-reporting changes are in `src/lib/coach/{limits,usage,service,http}.ts`, `src/lib/persistence/{shared-ai,coach-http}.ts`, `src/lib/coaching/errors.ts` and `src/lib/api/http.ts`. Regressions live in `tests/budget-errors.test.mjs` and `tests/database.test.mjs`. No production limits, reservation arithmetic, accounting records or database migrations are changed by the reporting fix.

## Environment reference

Existing OpenAI values are preserved. Variable values belong in `.env.local`, not documentation or chat.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable client key; never secret/service-role. |
| `SUPABASE_SECRET_KEY` | Server-only privileged operations described above. |
| `APP_ORIGIN` | Exact app origin for verification/recovery links. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Existing server-only provider configuration. |
| `OPENAI_REASONING_EFFORT` | Optional model-supported effort. |
| `USDA_FDC_API_KEY` | Optional server key for live USDA search/import. |
| `NUTRITION_ALLOW_FIXTURES` | Explicit development data fallback; defaults on only in development. |
| `COACH_PROVIDER_TIMEOUT_MS` | Per-call timeout, default 15000. |
| `COACH_REQUEST_TIMEOUT_MS` | Provider workflow timeout, default 45000. |
| `COACH_MAX_OUTPUT_TOKENS`, `COACH_POLICY_OUTPUT_TOKENS` | Main/policy output caps, defaults 1800/1000. |
| `COACH_REQUESTS_PER_MINUTE`, `COACH_GLOBAL_REQUESTS_PER_MINUTE` | Shared user/global request limits, defaults 8/30. |
| `COACH_MAX_CONCURRENT` | Shared global active-request cap, default 2; each user/conversation also limited to one. |
| `COACH_DAILY_TOKEN_LIMIT`, `COACH_GLOBAL_DAILY_TOKEN_LIMIT` | Shared user/global UTC-day token guards, defaults 100000/1000000. |
| `OPENAI_INPUT_PRICE_PER_MILLION`, `OPENAI_OUTPUT_PRICE_PER_MILLION` | Current operator-configured USD rates; blank means unknown. |
| `COACH_DAILY_COST_USD`, `COACH_GLOBAL_DAILY_COST_USD` | Optional shared USD caps; enabling either without prices fails closed. |
| `COACH_LOG_USAGE` | Legacy optional aggregate monitor logging; no conversation logging. Persistent usage is stored in `usage_events`. |

## API overview

Private endpoints accept either the verified browser cookie session or a Supabase access token from a native client. Never send a browser-selected user ID. General private APIs return `{ data, error }`; errors have a public `{ code, message }`. JSON inputs and external/reference/model records are checked with Zod. The existing Coach response shape is retained with additional `conversationId` and `saved` fields. New owned-resource routes return 404 for inaccessible IDs, without revealing who owns them.

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/v1/auth/signup`, `/login`, `/logout` | Email/password account flows. |
| `POST /api/v1/auth/recover`, `/password` | Non-enumerating recovery request and authenticated password update. |
| `GET/PATCH /api/v1/profile` | Read/update only the current profile. |
| `DELETE /api/v1/account` | Password reauthentication and account/data deletion. |
| `GET /api/v1/foods?q=…` | Stored source records or labelled permitted fixtures. |
| `GET /api/v1/foods?source=live&q=…` | Server-side USDA search with validated details. |
| `GET /api/v1/foods/[id]` | Stored food details including provenance and missing values. |
| `POST /api/v1/nutrition/recommendations` | Saved-preference-aware deterministic recipes and totals. |
| `GET/POST /api/v1/meal-plans` | List/save private meal plans. |
| `DELETE /api/v1/meal-plans/[id]` | Delete an owned plan. |
| `GET/POST /api/v1/coach/conversations` | List/start owned conversations. |
| `GET/PATCH/DELETE /api/v1/coach/conversations/[id]` | Read, rename or delete an owned conversation. |
| `POST /api/v1/coach/messages` | Authenticated scoped coaching with server-loaded history, profile and shared controls. |
| `GET /api/v1/coach/status` | Authenticated runtime configuration status, not secrets. |

Live message input is `{ message, conversationId, profile? }`. `profile` is an optional bounded session-only override; saved safety disclosures are retained. Conversation IDs must be owned by the verified caller. Client history/user IDs are not accepted. Food/meal/profile endpoints return consistent errors for expired sessions, invalid payloads, missing configuration or unavailable sources. No account-existence signal is intentionally returned by password recovery.

Public exercise endpoints remain `GET /api/v1/exercises`, `GET /api/v1/exercises?muscle=Traps`, `GET /api/v1/exercises/[slug]`, `POST /api/v1/training/recommendations`, and `GET /api/v1/health`. Existing `muscle=Legs` compatibility, experience/equipment rules, media placeholders and all detail slugs remain.

## Tests and local verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

Unit tests mock Auth/provider/network boundaries. Database tests run actual SQL and RLS with two test users in PGlite and need neither Docker nor external credentials. Coverage includes credentials, session validation, protected APIs, optional/partial profiles, saved personalisation, injection/scope/safety, numeric-nutrition rejection, equipment/IDs, provenance, serving/recipe math, missing nutrients, density, dietary/allergen filters, ownership, shared budgets and deletion cascades.

After configuring and starting a **local** Supabase stack and this app, explicitly opt into the real Auth/PostgREST/application integration test:

```sh
# Use local keys in .env.local and run npm run dev in another terminal.
TREVIKO_LOCAL_INTEGRATION=true npm run test:integration
```

This creates and deletes two temporary local test users, verifies isolation/authenticated API access and deletion, and sends only invalid AI requests so there are **no AI charges**. It refuses non-local Supabase/app hosts. It is skipped in ordinary `npm test`. For a hosted project, perform the separate two-account checklist above; do not point automated destructive user-creation/deletion tests at production.

Optional built-app HTTP checks without credentials or AI charges:

```sh
# Terminal 1, after npm run build:
npm start -- --port 3100
# Terminal 2:
node tests/http-smoke.mjs
```

These verify public Training/exercises, missing exercise API handling, account pages and unauthenticated/private API boundaries. Next.js can stream protected-route redirects or missing-page UI after starting an HTTP 200 response; tests check rendered redirect/not-found behaviour rather than assuming all such HTML has a 3xx/404 status.

For manual authenticated coaching, register/verify/log in, save beginner + dumbbells in Profile, start a Coach conversation and ask to train traps. Reload/reopen the chat, rename/delete it, and verify another account cannot open its ID. Then test a nutrition request, coding refusal, ambiguous request and a safety-sensitive question. A deliberate valid live Coach message can incur provider charges; automated tests never do.

## Deployment prerequisites and remaining limits

- **Still requires deployment verification:** the new coaching-plan migration, SMTP/verification/recovery delivery, hosted two-user plan isolation and the complete authenticated browser journey with live AI. Local SQL and mocked tests are evidence for implementation, not proof of a configured hosted deployment.
- Apply migrations, configure HTTPS origin/allowed email redirects, SMTP, Auth rate limits/bot protection and secrets. Confirm private session responses are not CDN cached. Configure model prices/USD caps and upstream spend controls. Review grants and run cross-user checks before public access.
- Scope classifiers and the separate response reviewer can make mistakes or be bypassed. Same-model review is not a guarantee of safety; adversarial evaluation with your configured model remains necessary. No tool/shell/database execution is exposed to the model.
- Food coverage is intentionally small; source/allergen review is incomplete. No verified traditional recipe catalogue, live grocery prices, clinical nutrition calculator or guaranteed allergy safety is claimed. No exercise photos have been verified; placeholders remain explicit.
- Runtime shared admission/budgets require the server secret and reachable PostgreSQL. Outages fail closed. Expired leases recover abandoned work; unknown token usage remains conservatively charged. Administrative imports consist of upserts rather than a bulk transactional ingestion pipeline; review results before production publication.
- Preference text and chat are personal data. Decide retention, deletion, consent, logging and backup policies for your deployment. No full-profile or message logging is enabled by this application. Account deletion cannot erase every external copy immediately.
- Milestone 5 has not been started.

## Changed files and architectural decisions

- `src/lib/supabase/`, `src/proxy.ts`: current SDK/SSR clients, verified sessions, cookie refresh and server-only admin boundary.
- `src/lib/auth/`, account API routes, `/auth/confirm`, signup/login/recovery/settings pages: authentication, verification, reauthentication and deletion.
- `src/lib/profile/`, Profile API, onboarding/profile components: structured preferences, transactional partial updates and minimal AI projections.
- `supabase/config.toml`, `supabase/migrations/`, `supabase/templates/`: local setup, additive schema, explicit RLS/ownership constraints, atomic shared AI controls and email links.
- `src/lib/persistence/`, conversation/meal-plan API routes: owner-scoped reads and server-validated writes; history from storage rather than the browser.
- `src/lib/nutrition/`, Nutrition page/components, `scripts/import-nutrition.mjs`, `scripts/fetch-fdc-fixture.py`: traceable adapter/snapshot, deterministic calculations, filtering and explicit administrative import.
- `src/lib/coach/`, `src/components/coach/CoachChat.tsx`: preserved scope/safety, asynchronous persistent usage reservations, qualitative nutrition, saved chat UI and existing exercise cards.
- `src/app/layout.tsx`, `src/app/globals.css`: account navigation and responsive form/meal/profile styles extending the existing design.
- `tests/database.test.mjs`, `milestone4.test.mjs`, `supabase.integration.test.mjs`, existing regression/smoke tests: real local PostgreSQL isolation, mocked service checks and opt-in local integration.
- `.env.example`, `package.json`, `package-lock.json`, `README.md`: safe configuration names, maintained Supabase dependencies, development-only PostgreSQL test engine and setup/verification instructions. Existing `.env.local` values were preserved.
