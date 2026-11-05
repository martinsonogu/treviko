# Community collaboration

Everything below is prepared for owner review. No issue, label, Discussion category or repository setting has been created remotely. Licensing and asset-rights approval in the [release review](OPEN_SOURCE_REVIEW.md) still applies.

## Where to start

Read [CONTRIBUTING](../CONTRIBUTING.md), choose one scoped issue below, and comment that you would like to work on it. Link the issue in a regular pull request. Use your own local/test services and sanitised fixtures; contributors must never receive production credentials.

[GitHub Issues](https://github.com/martinsonogu/treviko/issues) are for accepted, actionable work. [GitHub Discussions](https://github.com/martinsonogu/treviko/discussions) are recommended for questions and early ideas **after the owner enables them**; the link may be unavailable beforehand. Do not publish vulnerabilities or private training/health information in either place; follow [SECURITY](../SECURITY.md).

## Recommended labels

Create these labels manually after owner approval. Labels describe work, not an automatic promise that a task is easy or ready.

| Label                  | Suggested color | Description / use                                                                                                      |
| ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `good first issue`     | `7057ff`        | Small, well-scoped work with clear acceptance criteria and maintainer guidance; add only after checking prerequisites. |
| `help wanted`          | `008672`        | Maintainer welcomes a contributor; not necessarily beginner-level.                                                     |
| `documentation`        | `0075ca`        | Setup guides, examples, contributor instructions or user documentation.                                                |
| `bug`                  | `d73a4a`        | Confirmed behavior differs from intended behavior; include a reproducible case.                                        |
| `enhancement`          | `a2eeef`        | New capability or improvement without claiming an existing defect.                                                     |
| `accessibility`        | `5319e7`        | Keyboard, screen reader, zoom, motion or touch accessibility.                                                          |
| `testing`              | `1d76db`        | Automated coverage, fixtures and developer test tooling.                                                               |
| `internationalisation` | `bfd4f2`        | Message extraction, translation preparation, locale and plural handling.                                               |

Use a type label (`bug`, `enhancement` or `documentation`) plus relevant area labels. Apply `bug` only when a failure is reproduced; the drafts below are improvements, not invented bug reports. Reserve `good first issue` for bounded tasks with an available reviewer.

## Publish-ready issue drafts

Copy an individual title/body and its labels into GitHub only after owner approval. These are grounded in the listed files and require no production credentials. Do not implement all of them as one broad PR.

### C1 — Test enlarged text and landscape clearance on mobile

**Labels:** `enhancement`, `accessibility`, `testing`, `good first issue`, `help wanted`

**Description:** Existing browser fixtures cover 375px/390px and some reduced-height keyboard cases, but do not exercise enlarged text across Training, History and settings. Extend `scripts/check-navigation-browser.mjs` and `scripts/check-workouts-browser.mjs` using the real fixture components/CSS. Check behavior before proposing style fixes; do not claim a clipping bug without reproducing it.

**Acceptance criteria:**

- Add a 200% text-size case at 390px and a reduced-height landscape case.
- Assert keyboard access to final actions and clearance above fixed navigation, rather than only checking CSS class names.
- Keep existing normal-size checks and use mocked transport/disposable data.
- Report browser/viewport coverage and limitations; no physical-device claim.
- Any confirmed layout fix is small, preserves focus indicators and has a failing-before regression.

### C2 — Improve movement-specific instructions for two library exercises

**Labels:** `enhancement`, `help wanted`

**Description:** `src/lib/training/library.ts` includes generic opening instructions such as “Choose a comfortable range and establish a stable starting position.” Pick two named records, for example Dumbbell Shrug and another equipment-compatible exercise, and propose clearer starting position, movement and stopping cues. Use `ExerciseInstructions.tsx`'s existing movement/setup separation. Agree the two records with a maintainer first.

**Acceptance criteria:**

- Provide the exact two IDs, before/after text and authoritative source links for maintainer review.
- Write original concise prose or document permission for any reused text; do not copy restricted artwork or text.
- Preserve exercise IDs, slugs, equipment, alternatives, programming and prescriptions.
- Keep setup optional and do not turn placeholder images into a claimed demonstration.
- Existing library checks pass; a maintainer reviews fitness accuracy and provenance before merge.

### C3 — Make completed-workout reviews readable when printed

**Labels:** `enhancement`, `good first issue`, `help wanted`

**Description:** `src/components/workouts/WorkoutHistory.tsx` and completed workout reviews show actual saved results, but `src/app/globals.css` has no dedicated print treatment. Add a small print stylesheet for these views without adding export infrastructure.

**Acceptance criteria:**

- Hide fixed navigation and interactive actions in print while keeping the workout name, date, partial/completed status and actual set labels.
- Preserve weights/units and repetitions/seconds; avoid clipped content across multiple pages.
- Verify Print Preview with a long local sample and a partial workout.
- Make no persistence, automatic-download or PDF-library changes.
- Existing screen layouts and workout tests remain unchanged.

### C4 — Make browser fixture commands portable across operating systems

**Labels:** `enhancement`, `testing`, `good first issue`, `help wanted`

**Description:** The three `scripts/check-*-browser.mjs` commands accept `CHROME_BIN` but otherwise default to a macOS Chrome path. Add one shared executable resolver and an actionable missing-browser message.

**Acceptance criteria:**

- Preserve explicit `CHROME_BIN` precedence and support platform-appropriate Chrome/Chromium candidates.
- Share the resolver across navigation, typing and workout scripts without changing fixture assertions.
- Unit-test override, supported candidates and missing-executable behavior without launching a real browser in those unit tests.
- Keep browser launches opt-in and make no real AI/API requests.
- Document platform-specific invocation in CONTRIBUTING.

### C5 — Add an offline contributor-documentation link check

**Labels:** `documentation`, `testing`, `good first issue`, `help wanted`

**Description:** README, CONTRIBUTING, SECURITY and the new community/release guides have local file/heading links, but no reusable validation command. Add a dependency-light check that runs without network or credentials.

**Acceptance criteria:**

- Check relative file targets and heading anchors in the current contributor documents, excluding archived engineering notes.
- Add fixtures for a valid link, missing file/anchor and duplicate heading slugs, with useful filename/line diagnostics.
- Never crawl private URLs, execute documentation commands or access external services.
- Integrate through the existing Node test workflow and document how to run it.

### C6 — Prepare English workout-history strings for translation

**Labels:** `enhancement`, `internationalisation`, `help wanted`

**Description:** `src/lib/workouts/presentation.ts`, `src/components/workouts/WorkoutHistory.tsx` and the history page contain English literals and simple English pluralisation. `userProfileSchema.language` currently only accepts `en`; full language support is not implemented. Start with an inventory and a small English message catalog for the history UI, not a language-setting migration or app-wide framework.

**Acceptance criteria:**

- Inventory visible history strings, interpolation values and singular/plural cases; propose stable message keys for review.
- Extract that bounded set to an English catalog while preserving current rendered text and accessible labels.
- Add zero/one/multiple-count and missing-key fallback tests using existing fixtures.
- Preserve stored plan/exercise names, API identifiers, timezone behavior and the English-only profile schema.
- Do not machine-translate safety-critical exercise/allergy guidance, change AI prompts, add locale routing or add an i18n dependency in this first PR.

### C7 — Add sanitised screenshots for contributor onboarding

**Labels:** `documentation`, `help wanted`

**Description:** The README has screenshot placeholders. Capture Coach with an unconfirmed proposal, Training, workout completion and History using local fixture data at 390px and desktop. **Blocked until owner approval of branding redistribution rights.**

**Acceptance criteria:**

- Show only clearly fictional local data; no real email, profile, conversation, production URL or token.
- Use compressed images, meaningful alt text and short captions identifying the view and sample data.
- Record how each image was captured and the rights/provenance of visible artwork.
- Owner approves assets before adding them to the repository; no automatic publication.

## Discussions recommendation

The owner can enable **Settings → General → Features → Discussions** after reviewing moderation/reporting arrangements, then configure these categories from the Discussions page:

| Category                   | Format                | Purpose                                                                                                |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| Ideas and feature requests | Open-ended discussion | Explore the user problem and scope before converting an accepted idea into an issue.                   |
| Questions and support      | Question / answer     | Development setup and usage questions; mark useful answers. Never request credentials or private logs. |
| Show and tell              | Open-ended discussion | Sanitised demos, local experiments and contributions with asset permissions.                           |
| General discussion         | Open-ended discussion | Community introductions and project conversation within the Code of Conduct.                           |

Pin a welcome topic linking README, CONTRIBUTING, Code of Conduct, SECURITY and this issue backlog. Clearly state that support is best effort, production access is never offered, and security/conduct reports use private channels. The owner should identify moderators and a private reporting contact before enabling public participation. No categories or welcome topics have been published by this change.

## Contribution and review boundaries

Regular contributions use branches and pull requests with the existing checks. Small docs, tests and UI changes can follow normal maintainer review.

Changes to **authentication/session handling, Supabase RLS or ownership, service-role access, AI usage/cost/concurrency controls, deployment workflows or production configuration** require stricter maintainer review: discuss the design first, include targeted security/failure tests and operational implications, and get an explicit approval from a maintainer responsible for that boundary. Where the team has two eligible reviewers, require a second review for these areas. Never approve a change merely because CI is green. Schema/migration application, production credentials, deployment and publication remain maintainer-only operations.

No contributor receives production credentials. Contributors reproduce problems with local Supabase/their own development project and mocked AI. A regular PR never authorises a hosted migration, visibility change, deployment or credential rotation.

## Owner activation checklist

- Review licensing/reporting gates in [OPEN_SOURCE_REVIEW](OPEN_SOURCE_REVIEW.md).
- Approve and create the recommended labels, then publish chosen issue drafts individually.
- Enable Discussions and categories only after moderation/private reporting is ready.
- Configure main-branch protection to require PR review and the actual CI checks **lint**, **typecheck**, **tests**, **build**; keep the branch up to date and disallow force pushes/deletions. Confirm an eligible reviewer exists before enforcing review rules.
- Keep CI credential-free; review changes to `.github/`, hooks and dependency lockfiles as executable code.
- Do not treat local hooks as an enforceable security boundary: they can be bypassed. Mandatory checks are enforced by GitHub branch protection after the owner configures it.

## Tooling audit and verification

The initial audit found an existing Next.js ESLint flat configuration, strict TypeScript, four credential-free CI checks and no formatter or active custom hook. The tooling update retains those ESLint/TypeScript rules, adds ignores for coverage/generated Husky files, and adds only Husky, lint-staged and Prettier as exact development dependencies. No formatting plugin or second linter is installed. See [CONTRIBUTING](../CONTRIBUTING.md#local-tooling-and-pre-commit-workflow) for installation, applicable staged extensions and incremental formatting.

`tests/tooling.test.mjs` uses disposable local Git repositories to exercise actual hook installation, valid staged files, filenames with spaces, hidden unstaged edits, unsupported extensions, formatting failure and ESLint syntax failure. It also checks CI/HUSKY/production/archive installation skips. The fixture's full-test/build commands deliberately fail if called, so successful hooks verify those commands were not invoked. It never stages or commits the contributor's real work. GitHub CI/settings still require owner activation; no hosted workflow run is claimed.

Verification for this tooling update: lint, typecheck, selected-file formatting checks and production build passed. `CI=true HUSKY=0 npm test` passed 303 tests with one opt-in local Supabase integration test skipped (304 total). The two hook tests use temporary repositories and do not require hosted services. YAML triggers/check names and local documentation file links were also checked. No actual GitHub workflow was run, no repository setting was changed remotely, and no issue was published.
