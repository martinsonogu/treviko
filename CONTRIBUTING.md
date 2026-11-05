# Contributing to Treviko

Thanks for helping make personal training clearer and more accessible. Start with a small, focused improvement and explain the user benefit.

The open-source license and asset permissions are still awaiting owner approval. Until that decision is recorded, do not assume permission to redistribute this repository or submit third-party material under a proposed license. After licensing is confirmed, contributions must be material you have permission to contribute under the chosen terms. No CLA or DCO requirement is currently configured.

## Getting started

Follow the [README](README.md) using Node 24 and `npm ci`. Public Home, the library and the standard test suite need no service credentials. For account flows, use local Supabase or your own isolated development project. For optional live AI, use your own OpenAI project and spending controls. Maintainers do not provide production credentials.

Read `AGENTS.md` and the relevant installed Next.js guides under `node_modules/next/dist/docs/` when changing application code. This repository uses APIs that may differ from older Next.js versions.

## Choose and scope work

Check existing issues first. Publish-ready starter issue drafts and recommended labels are in [the community guide](docs/COMMUNITY.md#publish-ready-issue-drafts). Use [Discussions](https://github.com/martinsonogu/treviko/discussions) for early ideas and setup questions once the owner enables it; the link can be unavailable beforehand. Ask to take an issue, or describe the problem and proposed scope before a large change. Security reports belong in the [private reporting process](SECURITY.md), not a public issue.

Create a focused branch from current `main`. Keep unrelated formatting, generated files and dependency updates out of the change. Preserve the existing application architecture. Prefer existing components and services over parallel implementations.

## Maintainer review boundaries

Regular work goes through focused pull requests. Authentication/session handling, Supabase RLS/ownership and service-role access, AI usage/cost/concurrency controls, deployment workflows and production configuration require stricter maintainer review. Discuss the design before implementing those changes, include targeted security/failure tests and operational notes, and obtain approval from the responsible maintainer. Use a second eligible reviewer where available. Contributors never receive production credentials, and a code review does not authorise a hosted migration or deployment.

## Local tooling and pre-commit workflow

`npm ci` installs the pinned development tools and the `prepare` script installs Husky for a local Git checkout. It skips installation in CI (`HUSKY=0`), production-only installs and source archives without `.git`. If dependencies are already installed, run `npm run prepare` once. Node 24 is the supported contributor version; lint-staged requires Node 22.22.1 or newer.

Existing ESLint Next.js/TypeScript rules and strict TypeScript remain in place. ESLint did not enforce consistent formatting, so Prettier handles formatting separately, without an ESLint formatting plugin or duplicate lint configuration.

Stage only your intended changes, then commit normally. Husky runs `npm run lint:staged`: ESLint checks staged JS/TS variants and Prettier checks staged code, CSS, JSON, Markdown and YAML. Other files are not sent to unsupported tools. Generated output, package-lock, source nutrition snapshots, environment files, Supabase files and historical notes are excluded from Prettier. Never force-stage private environment files.

The hook checks rather than rewriting files. If it fails, format only the intended file(s), review the diff and re-stage:

```sh
npm run format -- path/to/file.tsx README.md
npm run format:check -- path/to/file.tsx README.md
git add path/to/file.tsx README.md
git commit
```

Both formatting commands expect explicit filenames or globs. Legacy application files were not mass-reformatted during setup; new/edited staged files must pass the configured formatter. Do not run a repository-wide formatting sweep as part of an unrelated PR. Local hooks do not run the full test suite, typecheck or production build. CI still runs the four full checks on every PR, and the owner must make those checks mandatory in branch protection. CI does not currently enforce a repository-wide Prettier baseline; staged formatting is incremental.

lint-staged handles filenames with spaces and temporarily hides unstaged portions of partially staged files. Avoid simultaneous edits during a commit. For a partially staged file that fails formatting, review formatting changes before re-staging the intended hunks; do not blindly stage the entire file. Hooks are convenience checks, not a security boundary: bypassing one does not waive CI or review requirements. CI installs with `HUSKY=0`; do not add secrets or privileged CI permissions to make a check pass.

## Product and security expectations

- Keep user data owner-scoped; preserve authentication, RLS and service-only write boundaries.
- Preserve immutable prescriptions, version protection, idempotent workout operations and local draft recovery.
- Keep AI use metered, bounded and mockable. Do not add paid calls to tests or silently change plans/preferences. Plans require an explicit reviewable proposal and confirmation.
- Use real, validated exercise IDs and source-backed nutrition calculations. Never fabricate performance metrics or source data.
- Provide visible keyboard focus, accessible labels, reduced-motion support and mobile safe-area clearance. Check 375px/390px and desktop when changing UI.
- Supply provenance and redistribution terms for images, data, fonts and copied code. Do not include production screenshots, personal messages or account exports.

Existing migrations are history, not editable setup scripts. If schema work is needed, discuss it, add an additive migration and include ownership/permission tests. Applying a hosted migration is a separate maintainer action; never embed it in contributor CI.

## Required checks

Run these from the repository root, sequentially:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests use Node's test runner, mocked OpenAI transport and PostgreSQL/PGlite. `npm test` does not need Docker, hosted credentials or paid AI. Do not use a real `.env.local` in CI. Typecheck and build both generate `.next` files; avoid running them simultaneously in the same checkout.

For UI changes, optionally run the existing Chrome fixture checks:

```sh
npm run test:navigation
npm run test:typing
npm run test:workouts
```

Set `CHROME_BIN` to the Chrome/Chromium executable if it is not at the scripts' default macOS path. Report viewport sizes and whether transport was mocked; do not claim physical-device or live-model testing without performing it.

### Optional local integration test

Start **local** Supabase and the application separately, and put only local stack credentials in `.env.local`. Then:

```sh
TREVIKO_LOCAL_INTEGRATION=true APP_ORIGIN=http://localhost:3000 npm run test:integration
```

This opt-in test creates and deletes two temporary local accounts, exercises Auth/PostgREST/application isolation and makes no valid paid AI request. It rejects hosted Supabase URLs. It is intentionally excluded from normal CI. Never point it at production or use production credentials to troubleshoot it.

## Pull requests

Use the PR template. Explain the problem, resulting behavior, files affected, tests and any remaining limitations. Add a regression test when behavior changes; documentation-only edits usually need checks rather than tests that repeat the prose. Include sanitised screenshots for visual changes. Distinguish mocked checks from real integrations.

Never attach environment files, database dumps, `.next`, tokens, actual profiles or private conversations. Before committing, review `git diff --cached` and the file list. A removed secret may still exist in Git history; follow [SECURITY](SECURITY.md) if exposure is suspected. Commit under your own chosen Git identity and review its email privacy settings.

A maintainer reviews correctness, accessibility, ownership and release impact before merging. CI does not deploy. Do not alter repository visibility, publish packages, rewrite shared history or rotate shared credentials as part of an ordinary contribution.
