# Security policy

Treviko handles private profiles, conversations, allergy preferences and workout records. Report suspected exposure, ownership bypasses, unsafe privileged writes or credential leaks privately.

## Reporting

After public launch, use GitHub **Security → Advisories → Report a vulnerability** when the owner has enabled private vulnerability reporting:

https://github.com/martinsonogu/treviko/security/advisories/new

This feature must be enabled and tested before release. While it is unavailable, contact the repository owner using an existing trusted private channel. No verified public security email is configured. Establishing that fallback contact is a launch blocker; do not post vulnerabilities publicly to request one.

Include affected commit/version, impact, minimal reproduction steps, and a sanitised proof of concept using your own disposable data. Do not send actual credentials, health information, customer records, or full database exports. Agree on a safe transfer method first if sensitive evidence is necessary. There is currently no guaranteed response SLA or bug bounty.

## Support scope

The current `main` development line is the review target. There is no stable release or supported maintenance-version matrix yet. Fixes and coordinated disclosure are handled by the owner; this policy does not authorise testing against hosted services or accounts you do not own.

## If a credential may have leaked

1. Stop sharing the material and notify the owner privately, identifying the location and credential type without reproducing the value.
2. The owner should assess access logs and revoke/rotate confirmed exposed credentials with the provider. Do not rotate shared keys without approval.
3. Remove exposure from current files, then review every branch/tag, historical blob, remote pull-request ref, fork, Actions log/artifact, cache and screenshot. Deleting a working-tree file is insufficient.
4. If history rewriting or log/artifact removal is needed, plan it with the owner, backups and collaborators. Rotation/revocation comes first; rewriting history does not make an exposed key safe. Do not force-push as part of a routine fix.
5. Verify the replacement credentials remain server-only and re-scan before publication.

## Contributor boundaries

Use your own local/development services. Never place a Supabase secret/service-role key, OpenAI key or database password in `NEXT_PUBLIC_*`, browser code, examples, issues or screenshots. A publishable/anon key is not a substitute for RLS. Do not disable authentication, ownership rules, concurrency limits, AI budgets or explicit plan confirmation to reproduce a problem.

Standard tests and CI use mocked AI and in-memory databases. CI has no deployment credentials, elevated fork-PR token or artifact upload. Keep that separation when proposing changes. Review dependency lockfile updates and preserve third-party license notices.

The [release review](docs/OPEN_SOURCE_REVIEW.md) records audit scope, findings and remaining publication gates. A pattern scan is not proof that a repository has never contained a secret.
