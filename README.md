# Treviko

A mobile-first personal training app with Kivo, an AI coach that works with your saved preferences, training plans and recorded workouts. Describe what you want to achieve, review a proposed plan, then train and log your actual sets. Nutrition coaching is optional.

Built with Next.js App Router, TypeScript, Tailwind CSS, Supabase and the OpenAI API.

**Open-source launch preparation:** the repository is awaiting owner review of licensing, asset rights and publication settings. MIT is the proposed default, but no project license has been granted yet. See the [release review](docs/OPEN_SOURCE_REVIEW.md). Keeping `package.json` private prevents accidental npm publication.

## What you can do

- Talk with Kivo, restore conversations and review structured training or nutrition proposals. Saving a plan requires explicit confirmation.
- Explore 48 typed exercises with equipment filtering and movement instructions. Exercise media are clearly marked placeholders.
- Start or resume a workout, record sets/reps/seconds and loads, finish partial or complete sessions, and add optional effort feedback.
- Review immutable workout history and progress based on actual completed sessions. Kivo can discuss saved actuals, exact history counts and bounded comparisons.
- Manage private profile preferences, authentication, password recovery and account deletion.
- Use five-tab mobile navigation and install the PWA on supported browsers. Connectivity is required; there is no service worker or offline synchronisation.

## Screenshots

Screenshots are pending. Capture the following using a disposable local account and invented test data, with no real email addresses, conversations, keys or infrastructure identifiers:

| View               | Capture to contribute                          |
| ------------------ | ---------------------------------------------- |
| Home / Training    | Mobile plan and start/resume actions           |
| Coach              | Conversation and an unconfirmed proposal       |
| Workout completion | Saved actual sets and optional effort check-in |
| History / Progress | Clearly labelled sample completed sessions     |

Do not substitute screenshots from a real user's account. The [contribution guide](CONTRIBUTING.md) explains review expectations.

## Start without credentials

Use Node.js 24 (`.nvmrc`) and npm. The lockfile is committed.

```sh
git clone https://github.com/martinsonogu/treviko.git
cd treviko
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

While the repository is private, cloning requires access. Open <http://localhost:3000>. Public Home and the exercise library work without credentials. Account features and live AI require the setup below; missing configuration does not simulate successful saves or AI responses. Automated tests mock paid OpenAI calls.

## Use your own development Supabase

Never use the maintainers' production project or ask for their keys.

### Local Supabase (recommended)

Install Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), start Docker, then run from this repository:

```sh
supabase start
supabase status
```

The local stack uses `supabase/config.toml`, the migrations in `supabase/migrations/` and the intentionally empty seed. Copy credentials from **your local** status output into `.env.local`; do not paste that output into issues or logs:

| Variable                               | Local CLI value                                 | Browser exposure           |
| -------------------------------------- | ----------------------------------------------- | -------------------------- |
| `APP_ORIGIN`                           | `http://localhost:3000`                         | Not a credential           |
| `NEXT_PUBLIC_SUPABASE_URL`             | Local API URL, usually `http://127.0.0.1:54321` | Public                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local publishable key, or legacy `anon` key     | Public; RLS still required |
| `SUPABASE_SECRET_KEY`                  | Local secret key, or legacy `service_role` key  | **Server only**            |

All migrations must be applied in order, including workout history query functions. `supabase migration list --local` checks the local history. If an existing disposable local stack is stale, `supabase db reset --local` rebuilds **and erases its local database**. Use it only when you intend to discard your local test data; never add `--linked` or `--db-url` to this reset command. Check the local email inbox URL shown by `supabase status` for signup/recovery messages. The checked-in local auth URLs/templates target port 3000.

### Your own hosted development project (alternative)

Create a separate Supabase development project. In Project Settings / API Keys obtain its project URL, publishable key and server secret (legacy anon/service-role keys are supported). Configure the same variables above. Configure Auth's Site URL as `http://localhost:3000` and allow `/auth/confirm`, `/auth/confirm?next=/reset-password` and `/reset-password` under that origin. Review the local email templates in `supabase/templates/` for corresponding confirmation/recovery behavior.

With the CLI authenticated to **your** account, explicitly link your development project, inspect migration history, then review a dry run before applying:

```sh
supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
```

If tables were created manually, stop and reconcile the schema/history rather than repeatedly running initial migrations or blindly marking them applied. Do not use a production database for contributor testing.

## Optional live AI and nutrition sources

In your local `.env.local`, set `OPENAI_API_KEY` to your own server-only project key and `OPENAI_MODEL` to an available model supporting Responses structured outputs. Set `OPENAI_REASONING_EFFORT` only if supported by that model, then restart Next.js. No live AI call is needed for lint, typecheck, tests or build. Live testing can incur charges; keep the existing user/global token, rate and concurrency controls. For cost caps, first configure current per-million model prices in the matching variables. The [environment template](.env.example) lists the available settings.

For local nutrition experiments, `NUTRITION_ALLOW_FIXTURES=true` enables clearly labelled development food/recipe fixtures. Numerical nutrient calculations are deterministic. Live USDA lookup additionally needs your own `USDA_FDC_API_KEY`. `npm run nutrition:import -- --apply` deliberately writes reference fixtures to the database configured in `.env.local`; run only against your reviewed development target. Adding `--live` fetches source records using your USDA key. This import is not required for the public library or automated tests.

## Progression coaching

Kivo can compare recorded exercise performances and training frequency using bounded owner-scoped history. It distinguishes recorded improvement, consistency, mixed results and insufficient evidence, and keeps plan changes reviewable. Load-entry conventions and incomplete logs limit what can be concluded. See the [progression guide](docs/PROGRESSION.md) for rules, the required read-only migration and real-workout verification steps.

## Architecture

```text
App Router pages and client components
  └─ /api/v1 authenticated route handlers
      ├─ Supabase Auth → owner-scoped services → PostgreSQL + RLS
      ├─ Coach → scope/safety → bounded context → metered OpenAI → independent review
      ├─ Plan proposals → verified exercise IDs / reference nutrition → explicit confirmation
      └─ Workout services → versioned writes, idempotent finish, immutable history
```

| Area                                                  | Location                                                 |
| ----------------------------------------------------- | -------------------------------------------------------- |
| Public/auth/authenticated shells                      | `src/app/`, `src/components/layout/`                     |
| Kivo conversation, safety and metering                | `src/lib/coach/`, `src/lib/persistence/`                 |
| Validated proposal workflow                           | `src/lib/coaching/`                                      |
| Workout lifecycle and history                         | `src/lib/workouts/`                                      |
| Exercise and nutrition reference data                 | `src/lib/training/`, `src/lib/nutrition/`                |
| Authentication/profile services                       | `src/lib/auth/`, `src/lib/profile/`, `src/lib/supabase/` |
| Schema, ownership rules and local auth templates      | `supabase/`                                              |
| Mocked service/API tests and PostgreSQL/PGlite checks | `tests/`                                                 |

Core data operations live behind reusable APIs for a future native client. No native application is included. Local draft recovery is not offline synchronisation.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Run typecheck and build sequentially: both generate `.next` type files. The standard suite includes in-memory PostgreSQL/PGlite security and persistence tests, with paid AI mocked. A local Supabase integration test is skipped unless explicitly enabled; see [CONTRIBUTING](CONTRIBUTING.md). CI uses no Supabase/OpenAI credentials.

Optional real-component Chrome checks: `npm run test:navigation`, `npm run test:typing`, `npm run test:workouts`. Set `CHROME_BIN` to your Chrome/Chromium executable outside the default macOS path. These use mocked transport and do not establish live-model or physical-device behavior.

## Production is a separate workflow

Contributor setup is not production deployment. Before deploying, provision a separate production Supabase project and server-only secrets, configure an HTTPS `APP_ORIGIN` and exact Auth redirect allowlist, review RLS/migrations and backups, disable development fixtures, and configure model budgets/prices. `NEXT_PUBLIC_*` values are embedded in client bundles and must never contain server keys. Use `npm run build` then `npm run start` in an appropriate Node hosting environment. CI does not deploy, import data or apply migrations.

Treat prompts, profiles, allergies and workout records as private. Do not upload `.env.local`, `.next`, database dumps, screenshots or request logs as debugging artifacts. Existing database protections are part of the product, not optional production configuration.

## How to Contribute

Read [CONTRIBUTING](CONTRIBUTING.md), choose a [beginner-friendly issue draft](docs/COMMUNITY.md#publish-ready-issue-drafts), and open a focused pull request. The owner will publish reviewed drafts as [GitHub issues](https://github.com/martinsonogu/treviko/issues). Ask setup questions or discuss early ideas in [Discussions](https://github.com/martinsonogu/treviko/discussions) once enabled; it may be unavailable until the owner activates it. No production credentials are provided to contributors.

See the [community guide](docs/COMMUNITY.md) for labels, review boundaries and recommended discussion categories.

## Release readiness

Read [CONTRIBUTING](CONTRIBUTING.md), [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) and [SECURITY](SECURITY.md). Publish-ready starter issues are in the [community guide](docs/COMMUNITY.md); the exact GitHub release configuration checklist is in the [open-source review](docs/OPEN_SOURCE_REVIEW.md). Historical implementation details and past manual checks are preserved in [engineering notes](docs/engineering-notes.md); those notes are not current setup instructions.

**Licensing decision pending:** MIT is proposed for owner-controlled code/documentation. The owner must confirm copyright ownership, contributor permissions, and rights to all artwork/data before adding a license. Dependencies and USDA data retain their own terms; an eventual project license does not replace them or automatically grant branding rights.
