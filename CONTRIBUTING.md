# Contributing to Treviko

Contributions improve personal training, accessibility and the developer experience. Read the [README](README.md) for setup and the [code of conduct](CODE_OF_CONDUCT.md) for community expectations.

## Contribution workflow

1. Check [existing issues](https://github.com/martinsonogu/treviko/issues). Choose a small issue or discuss the scope of larger work with a maintainer.
2. Create a focused branch from `main`.
3. Use your own local/development Supabase and OpenAI services. Maintainers do not provide production credentials.
4. Implement the change and add relevant regression coverage.
5. Run the checks below and open a pull request describing the change and validation.

Keep unrelated formatting, generated files and dependency updates out of the change. Read `AGENTS.md` and the installed Next.js guides under `node_modules/next/dist/docs/` when changing application code.

## Checks and Git hooks

Use Node.js 24 and `npm ci`. Husky installs the pre-commit hook for local Git checkouts. It skips CI, production-only installs and source archives without `.git`. Run `npm run prepare` if dependencies were installed before the hook was configured.

The hook runs ESLint and Prettier checks on applicable staged files; it does not run the full suite or build. To fix formatting, format only your intended files, review the diff and stage them again:

```sh
npm run format -- path/to/file.tsx
git add path/to/file.tsx
```

Run these checks before opening a pull request:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Run typecheck and build sequentially. CI runs these four checks on pull requests. Tests mock paid AI calls and use PostgreSQL/PGlite for database protections.

Optional Chrome checks:

```sh
npm run test:navigation
npm run test:typing
npm run test:workouts
```

Set `CHROME_BIN` if Chrome/Chromium is not at the scripts' default macOS path. Report tested viewport sizes and whether transport was mocked; distinguish browser emulation from physical-device testing.

For the opt-in local integration test, start local Supabase and the app, set local credentials in `.env.local`, then run:

```sh
TREVIKO_LOCAL_INTEGRATION=true APP_ORIGIN=http://localhost:3000 npm run test:integration
```

This test creates disposable local test users. Do not point it at production.

## Review boundaries

Authentication, Supabase RLS/ownership, privileged operations, AI cost controls, migrations and deployment changes require focused maintainer review and targeted failure/security tests. A pull request does not authorise a hosted migration or deployment. Add new migrations rather than editing migration history.

Preserve explicit plan confirmation, immutable workout prescriptions, concurrency protection and idempotent completion. Keep private records owner-scoped, AI calls bounded and mockable, and nutrition calculations grounded in reference data. Never commit credentials or real user data.

UI changes need visible keyboard focus, accessible labels, reduced-motion support and mobile safe-area clearance. Check 375px, 390px and desktop widths where relevant.

## Licensing and reporting

Code/documentation contributions use the [MIT licence](LICENSE). Exercise illustrations use [CC BY 4.0](public/exercises/LICENSE.md). Contribute material you have permission to provide, with source and redistribution terms for third-party assets. No CLA or DCO requirement is configured.

Report vulnerabilities privately as described in [SECURITY](SECURITY.md), not in public issues or pull requests.
