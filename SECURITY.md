# Security policy

Treviko handles private profiles, conversations, allergy preferences and workout records. Report suspected exposure, ownership bypasses, unsafe privileged writes or credential leaks privately.

## Reporting

Use GitHub **Security → Advisories → Report a vulnerability**:

https://github.com/martinsonogu/treviko/security/advisories/new

If you cannot access the reporting form, contact the repository owner through an established trusted private channel. Do not post vulnerability details or sensitive evidence publicly.

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
