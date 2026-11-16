# Treviko

A mobile-first personal training app with **Kivo**, an AI coach that connects your goals, training plans and recorded workouts. Nutrition coaching is optional.

Built with Next.js App Router, TypeScript, Tailwind CSS, Supabase and the OpenAI API.

## Features

- Personalised training and nutrition proposals, with explicit confirmation before saving.
- Persistent Coach conversations, plan revisions and coaching based on recorded workout history.
- A library of 48 exercises with anatomical illustrations, equipment filters and movement instructions.
- Workout start/resume, set logging, completion, effort feedback and immutable training history.
- Progress summaries based on saved sessions.
- Account authentication, profile preferences, password recovery and account deletion.
- Responsive desktop navigation and five-tab mobile navigation, with PWA installation support. An internet connection is required.

## Getting started

Use Node.js 24 and npm.

```sh
git clone https://github.com/martinsonogu/treviko.git
cd treviko
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Home and the exercise library work without service credentials. Account features require Supabase; live coaching also requires your own OpenAI credentials.

## Configuration

Keep credentials in `.env.local`, which is ignored by Git. The [environment template](.env.example) lists all settings. Use your own development services.

| Variable                               | Purpose                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `APP_ORIGIN`                           | `http://localhost:3000` locally; your HTTPS origin in production             |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key, or legacy anon key                             |
| `SUPABASE_SECRET_KEY`                  | Server-only secret key, or legacy service-role key                           |
| `OPENAI_API_KEY`                       | Server-only key for live coaching                                            |
| `OPENAI_MODEL`                         | A model available to your project that supports Responses structured outputs |
| `USDA_FDC_API_KEY`                     | Optional live USDA nutrition lookups                                         |

### Local Supabase

Install Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), start Docker, then run:

```sh
supabase start
supabase status
```

Copy your local URL and keys into `.env.local`. The local stack applies the migrations in `supabase/migrations/`; check them with `supabase migration list --local`. Use the local email inbox shown by `supabase status` for signup and recovery messages.

### Hosted development Supabase

Create a separate development project, configure its URL and keys, and set Auth's Site URL to `http://localhost:3000`. Allow these redirect URLs under that origin: `/auth/confirm`, `/auth/confirm?next=/reset-password` and `/reset-password`.

```sh
supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
```

Review the target and migration list before applying. Existing manually created schemas need migration-history reconciliation rather than repeated initial migrations or a database reset.

### AI and nutrition

Set your OpenAI key and model, then restart the app. Live calls incur charges. User/global rate, concurrency and token limits are built in; configure model prices before enabling monetary caps. Set `OPENAI_REASONING_EFFORT` only when supported by your chosen model.

`NUTRITION_ALLOW_FIXTURES=true` enables development nutrition fixtures. Nutrition calculations use reference data separately from AI-generated descriptions. `npm run nutrition:import -- --apply` writes reference data to the configured database; use your development project. Add `--live` for USDA source records.

## Development

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Run typecheck and build sequentially because both generate Next.js type files. Tests mock paid AI calls and include PostgreSQL/PGlite ownership and persistence checks. No live credentials are required for these checks.

Validate the released exercise images with `node scripts/audit-exercise-illustrations.mjs`. See [CONTRIBUTING](CONTRIBUTING.md) for Git hooks, browser checks and local integration tests.

## Architecture

| Area                                     | Location                                                 |
| ---------------------------------------- | -------------------------------------------------------- |
| App routes and responsive UI             | `src/app/`, `src/components/`                            |
| Kivo safety, context and metering        | `src/lib/coach/`, `src/lib/persistence/`                 |
| Plan proposals and confirmation          | `src/lib/coaching/`                                      |
| Workout lifecycle and progression        | `src/lib/workouts/`                                      |
| Exercise and nutrition reference data    | `src/lib/training/`, `src/lib/nutrition/`                |
| Authentication and profiles              | `src/lib/auth/`, `src/lib/profile/`, `src/lib/supabase/` |
| Database schema and local Auth templates | `supabase/`                                              |

Private operations use authenticated `/api/v1` handlers and Supabase ownership checks/RLS. Workout writes use version protection and idempotent completion. Kivo compares compatible saved performances within bounded history; it does not infer unrecorded workouts or physiological improvements. Plan changes require confirmation.

## Deployment

Build with `npm run build` and serve with `npm run start` on a supported Node.js host. Use a separate production Supabase project and server-managed secrets.

For `https://treviko.fit`, set `APP_ORIGIN=https://treviko.fit` and configure Supabase's Site URL and the three Auth redirect paths above on that origin. Rebuild after changing `NEXT_PUBLIC_*` values. Disable development fixtures, use production reference data, and configure model budgets, SMTP, backups and HTTPS. CI runs checks; it does not deploy or apply database migrations.

## How to contribute

Read [CONTRIBUTING](CONTRIBUTING.md), find an [issue](https://github.com/martinsonogu/treviko/issues), and open a focused pull request. Follow the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through the [private security process](SECURITY.md).

## Licence

Code and documentation: [MIT](LICENSE), copyright 2026 Treviko contributors.

Exercise illustrations: [CC BY 4.0](public/exercises/LICENSE.md). Dependencies and source data retain their own terms. The code licence does not grant trademark rights in Treviko branding.
