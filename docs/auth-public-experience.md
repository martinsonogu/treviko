# Public, authentication and personal coaching experience

## Confirmed causes

The root layout rendered the top account link and `Nav` unconditionally. Login, recovery, public discovery and signed-in coaching therefore inherited the same floating navigation. `AuthForm` reused the general account form (up to 760px wide) and rendered the same three links in every mode, including a redundant sign-in link on login. The login error appended an email-verification suggestion regardless of the actual failure. Progress displayed an internal milestone placeholder.

The deletion API already required a verified user, password reauthentication and a successful administrative delete. However Settings redirected using `deleted=true`, Login did not implement a completion screen, and SDK sign-out failure was ignored without a guaranteed browser-cookie clear. A URL flag could not safely become proof of account deletion.

## Architecture and behaviour

The root layout now contains only the shared document, styles and skip link. `(auth)` supplies the compact branded authentication shell. `(experience)` supplies a server-aware public or signed-in shell. Route groups do not change URLs: `/`, `/login`, `/coach`, `/training`, exercise detail links and all APIs retain their paths. `/auth/confirm` remains a server-only redirect handler and renders no application chrome.

A React request-scoped identity helper verifies the user on the server. Visitors see public discovery, Sign in and Create account links, with no app bottom navigation. Verified users receive the desktop top navigation or mobile bottom navigation plus Account & sign out. Public Home and Training use the same verified identity helper as the shell. Session-service failures produce a reconnect state rather than a public marketing page masquerading as a signed-in account. Protected handlers still verify users independently; no private content is granted by client state or the layout.

Login, signup, recovery and reset use compact forms (maximum 420px), explicit labels, appropriate autocomplete, keyboard focus, a show/hide password control, minimum touch sizes, loading indicators, safe messages and synchronous duplicate-submit locks. Passwords never go into a GET query if JavaScript has not loaded. Login has a single primary action, a separate recovery link and a clearly separated registration link. A successful login verifies the response and makes a fresh document navigation to the safe requested page, clearing prior in-memory account UI. Already-authenticated login/signup visits redirect into the app. Auth routes, external URLs and encoded variants cannot become return-to-page redirect loops.

Progress now requires sign-in, preserves `/progress` as the return destination and shows an honest no-history state. No workout logging, statistics, progress analytics or milestone labels were introduced. The exercise library and details remain public; authenticated Training still shows the saved plan first. Coaching-plan generation, programming, nutrition generation, optional nutrition, RLS and saved-plan data were not changed by this task. Existing uncommitted training-first work was preserved.

## Verified deletion completion

Only the successful deletion handler issues `treviko-deletion-complete`: an HttpOnly, SameSite=Lax cookie, Secure in production, scoped to `/login`, with a 120-second lifetime. Its non-identifying timestamp/purpose/random-nonce payload is HMAC-signed using the existing server secret with a separate purpose prefix. It includes no email, password, user ID or access token. No new key or database table is required.

The handler checks the signing configuration before destructive work, preserves password reauthentication and ownership, then issues proof only after the provider confirms deletion. It attempts SDK local sign-out and explicitly expires this project's browser auth-token chunks and PKCE cookies even if SDK sign-out fails. The settings client requires `{deleted:true}`, clears its password and confirmation fields and performs a fresh document redirect.

`/login?deleted=true` displays the deletion success heading and Create a new account action only if the signed, unexpired cookie verifies and there is no verified current user. The success state has no credential fields and ignores stale verification-error flags. A query flag without proof shows an informational notice, not a deletion claim. Visiting ordinary `/login` allows signing into another account. Successful login/signup/reset/logout clears the notice cookie. This is short-lived proof, not a one-time database receipt; it can be revisited within its lifetime. It never authorises account access. Key rotation or blocked cookies safely prevents verification.

Browsers/password managers may retain credentials independently of the website; the app cannot erase that storage. The application does not supply old credentials or keep them in local/session storage, and the verified deletion screen mounts no login form.

## Authentication errors and email privacy

Trusted provider codes/statuses are mapped to safe application categories for bad credentials, temporary service/network failures, rate limits and password-policy problems. Internal errors/credentials are never rendered. Generic failed sign-in does not assert that an email address exists or needs verification. Verification guidance is shown only when a trusted successful user response itself shows an unconfirmed user; an `email_not_confirmed` error alone receives the generic credential response, preserving conservative enumeration protection.

Signup and recovery retain neutral check-your-inbox messages, including existing/unknown-account responses. Autoconfirmed signups navigate to onboarding only if an actual authenticated session is returned. Password reset requires a verified session; invalid recovery callbacks lead to a reset-link-unavailable screen. Successful password updates require explicit confirmation from the API and show a clear continuation action. Rate limits retain Retry-After. The implementation follows the [Supabase error-code guidance](https://supabase.com/docs/guides/auth/debugging/error-codes) and handles the documented possibility of [sign-out failure retaining local state](https://supabase.com/docs/reference/javascript/auth-signout).

## Files changed

- `src/app/layout.tsx`: minimal shared document and skip link.
- `src/app/(auth)/layout.tsx` and the moved login/signup/forgot-password/reset-password pages: dedicated auth shell; URLs unchanged.
- `src/app/(experience)/layout.tsx` and the moved Home/Coach/Training/Nutrition/Profile/Onboarding/Settings/Progress pages: server-aware experience shell; original route URLs preserved. Progress's page now guards access and renders the honest empty state.
- `src/components/layout/{ExperienceFrame,ReloadButton}.tsx`, `src/components/Nav.tsx`: verified public/app chrome, reconnect state and desktop/mobile navigation.
- `src/components/auth/AuthContent.tsx`: page states, safe redirects, verified deletion state and reset-link state.
- `src/components/account/{AuthForm,SettingsPanel,ProgressEmpty}.tsx`, `auth-request.ts`, `delete-account.ts`: compact accessible forms, safe confirmed outcomes and cleared deletion credentials.
- `src/lib/auth/{page-user,deletion-notice,errors}.ts`, `session.ts`, `schemas.ts`, `service.ts`: request-scoped identity, signed proof, forced cookie clearing, safe error mapping and redirect protection.
- `src/app/auth/confirm/route.ts`, `src/proxy.ts`: recovery/verification destinations and identity refresh on public exercise details/Progress.
- `src/components/coaching/{HomeContent,AccountPlan}.tsx`: identity-gating integration only; no coaching-plan or exercise selection logic changes.
- `src/app/globals.css`: auth forms, password controls, public header, responsive app navigation, safe-area spacing and focus states.
- `tests/auth-experience.test.mjs`: new layout/form/flow/deletion/error/redirect/privacy regressions.
- `tests/{training,profile-save,coaching-plan,milestone4}.test.mjs`, `tests/http-smoke.mjs`: updated source paths, deletion-proof test setup and built-app public/protected/auth boundaries.
- `README.md` and this report: current architecture and verification steps.

No new migration or Supabase configuration change is required for this authentication/navigation work. The previously implemented training-first migration belongs to that earlier task and has already been applied; it is not replaced or rerun here. No new secret, live email send, real account deletion or paid AI request was performed.

## Exact manual browser checks

1. Restart `npm run dev`. In a signed-out/private browser window open `/`: expect the public hero, Get started, Sign in/Create account and no app bottom navigation.
2. Open `/training` and an exercise detail. Confirm public access, a clear personal-plan sign-in CTA, and the existing How to Perform/default and Equipment Setup tabs. No app navigation should appear.
3. Open `/coach`, `/nutrition` and `/progress`. Confirm Login with the intended destination in `next`. Login should have Welcome back / Continue your coaching journey, a compact form, recovery link and one registration link, without app navigation or another sign-in link.
4. Tab through the form; toggle password visibility with the keyboard; test an incorrect password, offline request and rate-limited response. Errors must be useful, announced and free of provider diagnostics. Repeated rapid clicks should send one request.
5. Sign in successfully from `/login?next=%2Fcoach`. Confirm `/coach` opens with desktop top navigation or mobile bottom navigation, and Account & sign out. Home must show the member dashboard/no-plan state, never public marketing. Training must show the saved plan before the library. Existing optional nutrition remains unchanged.
6. Open `/login?next=/login` while signed in. Confirm it returns to `/` rather than looping. Sign out from Settings and verify public/auth pages contain no stale app navigation/private content.
7. Register a disposable test account. Verify the neutral inbox guidance and real confirmation email/redirect/onboarding. Test recovery, an expired or reused recovery link, a new valid link and password-reset success. Live email/SMTP delivery remains a deployment check.
8. First visit `/login?deleted=true` directly with no deletion cookie: expect informational text, never a confirmed deletion claim.
9. Only with a disposable account you intend to delete: in Settings provide the current password and exact confirmation. After successful deletion expect the clear account-deleted heading, Create a new account action, no credentials, no stale errors and no app navigation. Inspect that project auth cookies are expired and the short-lived notice is HttpOnly. Confirm the deleted account cannot access protected routes. An incorrect password or failed delete must not produce this success state.
10. Revisit the deletion URL after two minutes or remove/alter its cookie: expect informational state. Create/sign into another account and ensure old deletion success is not shown for the signed-in account.
11. At approximately 360px wide and with the mobile keyboard open, verify fields/buttons remain reachable, no horizontal scroll, and no floating navigation on auth screens. On signed-in pages check safe-area spacing below content. At desktop widths verify top navigation and no duplicate bottom bar.

## Limitations

Automated provider/session boundaries are mocked; no hosted SMTP, real login/logout/password recovery, real deletion or full interactive browser journey is claimed. The built-app HTTP checks cover anonymous rendering and redirect boundaries, while server/component tests cover verified-account branches. The deletion receipt is intentionally short-lived and stateless; it is not a permanent deletion-audit record. Password-manager autofill is browser-controlled. Forms require JavaScript for their interactive flow; POST prevents fallback query-string credential leakage. Workout logging and analytics remain unimplemented.

## Verification results

- `npm run lint`: passed without warnings.
- `npm run typecheck`: passed.
- `npm test`: **186 passed, zero failed, one opt-in integration test skipped** (187 total). Seventeen new authentication/navigation tests cover the scenarios above.
- `npm run build`: passed.
- `node tests/http-smoke.mjs` against the built app: passed public pages and exercise details, protected routes, private API boundaries, absence of signed-in navigation on public/auth pages, informational handling of a forged deletion query, and preserved return destinations. No paid AI or account mutations.
- `git diff --check`: passed.
- No migration, new credential, hosted account mutation or paid AI request was required. Changes remain uncommitted on `fix/ai-plan-generation`.
