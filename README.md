# Treviko

Mobile-first AI personal trainer with integrated, optional nutrition coaching, built in the existing Next.js App Router repository. Milestones 1–3 remain available: 48 typed exercises, 12 muscle groups, deterministic targeting, compatible equipment filtering, accessible exercise-detail tabs, and server-side OpenAI coaching with scope/safety checks.

Milestone 4 adds Supabase-backed accounts, onboarding, private preferences, saved conversations, source-backed nutrition utilities, meal plans, account deletion and database-shared AI controls. **Supabase must be configured and the migrations applied before account features work.** Missing configuration produces a setup message or protected-route redirect; it never simulates a successful login or database save. Public Training and Progress still work without Supabase.


## Training-first coaching experience

Home, Training, Nutrition and Coach read the same confirmed coaching record, with independently editable training and nutrition components. Workout and vague personal-plan requests default to **training only**. Meals are generated only for an explicit nutrition request or a combined selection. The Coach workspace offers Training only, Nutrition only, Training and nutrition, or automatic intent. Saved dietary preferences alone never opt users into meal planning.

**Required setup:** apply the additive migration `supabase/migrations/202611050002_training_first.sql` once after the three existing migrations. With the existing migrations correctly tracked, run `supabase db push --dry-run`, check that only this file is pending, then `supabase db push`. For SQL Editor installations run only the new file as a transaction. No data reset or new credentials are needed. It adds prescription/timing columns, permits a nutrition-first record without workouts, and replaces the service-only confirmation transaction to preserve untouched components. Existing snapshots remain readable. A generic cable machine no longer implies a dedicated lat-pulldown station; confirm the new equipment option in Profile only if actually available.

On Home choose **Create my training plan**. Describe your needs in Coach, review the schedule, complete prescriptions, computed duration estimates, warm-up, effort guidance, progression and compatible alternatives, then explicitly **Confirm & save**. Nutrition can be added later, without replacing workouts. A training-only confirmation preserves existing meal references; a nutrition-only confirmation preserves existing workout rows. Global version checks still reject stale tabs, and preference changes invalidate a preview. Model text never writes to the database directly. Ordinary chat can pass a message and owned history into this same preview workflow.

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

See [the training-first report](docs/training-first-refinement.md) for changed files, deterministic rules, illustrative outputs, limitations and exact manual steps. The prior [architecture](docs/ai-first-plan.md) and [generation-failure investigation](docs/plan-generation-fix.md) describe earlier stages. Automated tests mock paid AI and execute real SQL locally; hosted migration application, actual model quality for the new scope contract and the complete authenticated browser journey require manual verification. No workout logging or analytics were added.

## Public and account experience

Public Home and the exercise library remain available without an account. Authentication uses a compact dedicated layout; app navigation is shown only after server-verified sign-in. Signed-in members get desktop top navigation/mobile bottom navigation and Account & sign out. Progress requires sign-in and shows a no-history state without internal milestone labels. Public/auth/private URLs are unchanged; App Router route groups separate their layouts.

Deletion completion uses a short-lived signed HttpOnly cookie issued only after successful account removal; `deleted=true` alone never proves deletion. Browser auth cookies and in-memory credentials are cleared on the completed flow. Login preserves safe return destinations, forms have accessible show/hide controls, and signup/recovery messages remain non-enumerating. No new migration, key or Supabase setting is required for this UI work. See [the report and exact manual verification steps](docs/auth-public-experience.md).

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

## Coach conversation behaviour

Greetings, introductions, experience/body-measurement statements and coaching follow-ups are in scope. Semantic safety/injection checks run before narrowly defined conversational recovery. The model receives explicit saved/provided preferences separately from sourced facts mentioned by the user in the current conversation; assistant guesses are not user facts. No inferred conversation details are automatically written to Profile. Missing equipment can limit exercise cards without blocking useful general coaching.

The active conversation is restored from its URL UUID through the authenticated API. Start fresh conversation clears that UUID and starts new context; old saved chats remain selectable. Failed optimistic bubbles are removed and wrong/stale-conversation replies are ignored. Reload saved chat reconciles uncertain network results before retrying.

See [the conversation-fix report](docs/coach-conversation-fix.md) for the confirmed causes, changed files, exact six-turn regression, manual test steps and remaining limitations. Tests mock all paid provider calls. Source and safety instructions remain separate from untrusted context, following [official OpenAI prompting guidance](https://developers.openai.com/api/docs/guides/prompt-engineering).

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
