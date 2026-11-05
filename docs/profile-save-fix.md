# Profile save and Coach loading verification

The final save previously navigated only when `ProfileEditor` received `onboarding=true`. The `/profile` page passes `false`, so its successful final save left the user on Step 7.

The shared save workflow now verifies the API's database-read response against the submitted preferences before navigating. Finishing `/profile` marks onboarding complete and replaces the route with `/`; finishing `/onboarding` preserves its intended `/coach` destination. Both refresh server state. A synchronous lock prevents duplicate submissions and fields remain disabled during saving. Failed or incomplete responses show an error without navigating. Completed users visiting `/onboarding` return home; `/profile` remains available for editing, including “Save & keep editing”.

Coach displays a spinner and live status while generating, with separate labels for restoring or updating conversations. Reduced-motion users receive a static indicator.

## Manual verification

1. Run `npm run dev`, sign in with an account whose onboarding is incomplete, and open `/profile`.
2. Enter distinctive preferences, reach Step 7, and click “Save preferences” rapidly twice. Confirm one PATCH to `/api/v1/profile` in browser Network tools, then navigation to `/`.
3. Return to `/profile`, reload, and confirm the preferences remain. Open `/onboarding` and confirm it returns to `/` without a loop.
4. Edit a completed profile, reach Step 7, and choose “Save & keep editing”. Confirm it stays on the form and persists after reload. Choose “Save & return to dashboard” to confirm navigation to `/`.
5. With another incomplete account, finish `/onboarding` and confirm navigation to `/coach`.
6. Block `/api/v1/profile` in browser Network tools and attempt a save. Confirm an error, no navigation, retained inputs, and an enabled retry button. Unblock it and retry.
7. In Coach, send a message. Confirm the spinner and “Coach is preparing your response…” remain during the request and disappear on success or failure. Enable reduced motion and confirm the indicator stops rotating.

## Automated coverage

`tests/profile-save.test.mjs` exercises the actual save workflow, returned-data confirmation, failure/retry, duplicate submissions, destinations, edit behaviour, server-page onboarding guards, and accessible loading states. `tests/database.test.mjs` verifies preferences and onboarding completion persist across user-session changes using the real SQL migrations in PostgreSQL via PGlite. Hosted Supabase/browser verification remains manual; automated tests do not incur OpenAI usage.
