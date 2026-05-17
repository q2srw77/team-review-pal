## Goal

Verify that recent security hardening (server-enforced email link origin, server-enforced WebAuthn rpID/origin, edge function authorization tightening, SECURITY DEFINER privilege revokes) did not break any user-facing flow. No code changes — purely verification, with a short list of follow-ups only if something is actually broken.

## Scope of recent changes to re-validate

1. `notify-request-event` — `app_url` removed from request body; appUrl now built from `APP_ORIGIN` env (fallback `https://reviewhub.cyphersecurity.us`).
2. `RequestForm.tsx` — no longer sends `app_url`.
3. Passkey edge functions (`passkey-register-options`, `passkey-register-verify`, `passkey-auth-options`, `passkey-auth-verify`) — rpID/origin no longer accepted from client; derived server-side from a built-in allowlist (`reviewhub.cyphersecurity.us`, `team-review-pal.lovable.app`, preview `id-preview--…lovable.app`) plus optional `APP_ORIGIN` / `APP_ORIGIN_ALLOWLIST` env vars.
4. `src/lib/passkeys.ts` — no longer sends rpID/origin/rpName.
5. `send-transactional-email` — restricted to service-role / admin callers only.
6. `generate-review-report` — submitter/team-member/admin authorization enforced after JWT validation.
7. SECURITY DEFINER privilege revokes from PUBLIC/anon/authenticated (except `has_role`, `is_team_member`).

## Verification plan

### A. Static / read-only checks

1. Search the repo for any remaining references to `app_url`, `rpID`, `origin` in client → edge function invocations to confirm nothing else still sends them.
2. Search for direct client calls to `send-transactional-email` — there should be none from the browser; only `notify-request-event`, `request-password-reset`, `resubmit-for-review`, `finalize-review-request`, `auto-close-overdue-requests`, `send-review-reminders` should invoke it (service-role or admin context).
3. Open `supabase/functions/_shared/webauthn-config.ts` and confirm the three default allowed origins cover the preview, published, and custom-domain hosts the project actually uses (cross-check `project_urls`).
4. Confirm `send-review-reminders`, `finalize-review-request`, `resubmit-for-review`, `auto-close-overdue-requests`, and any other server-side caller of `send-transactional-email` use the service-role key (since the function is now admin/service-role only).
5. Re-read `generate-review-report` to confirm the authorization branch still allows: submitter, team member, and admin — and rejects everyone else with 403.

### B. Edge function smoke tests (via `supabase--curl_edge_functions`)

For each, observe status + body; do not require a UI interaction.

1. `notify-request-event` with no auth → 401.
2. `notify-request-event` as a non-related authenticated user for someone else's request → 403.
3. `notify-request-event` as the submitter with `event: "request_created"` for a real request → 200, `sent >= 0`. (Use an existing test request, do not create one.)
4. `send-transactional-email` called as a regular authenticated user → should be 403.
5. `generate-review-report` as a non-related authenticated user → 403; as the submitter → 200.
6. `passkey-auth-options` with no body → 200 with `options.challenge` present (no longer requires `rpID`).
7. `passkey-register-options` without auth → 401; with auth but no body → 200 with `options.challenge`.

### C. End-to-end UI flows in the preview

Run through these in the browser preview to confirm no regression:

1. **Login (password)** — sign in as an existing admin and a non-admin.
2. **Dashboard load** — admin sees all, non-admin sees team-scoped requests.
3. **Create review request** — submit a new request and confirm:
   - row appears in the DB
   - team members receive the "new review request" email (check `email_send_log`)
   - the email button URL points to `https://reviewhub.cyphersecurity.us` (server-built), NOT the preview host
4. **Review flow** — a reviewer marks a request as completed; when all complete, status flips to `correction` and the submitter receives the "all complete" email.
5. **Corrections / resubmit** — submitter resubmits; new deadline applied; reviewers re-notified.
6. **Generate PDF report** — submitter and admin can generate; an unrelated non-admin user cannot.
7. **Password reset** — request a reset, confirm the email link uses `reviewhub.cyphersecurity.us`.
8. **Passkey register** — register a passkey from Profile → Passkeys on the preview origin. Confirm it succeeds (preview origin is in the server allowlist).
9. **Passkey sign-in** — sign out, then sign in with the registered passkey on the preview origin.
10. **Passkey on published domain** — repeat register + sign-in on `team-review-pal.lovable.app` and on `reviewhub.cyphersecurity.us` to confirm all three origins still work after the allowlist change. (If the user has not deployed yet, this can be deferred.)

### D. Logs / observability checks

1. `email_send_log` — confirm recent transactional sends have `status = sent` (or at minimum `pending`); no spike in `failed` since the changes.
2. Edge function logs for `notify-request-event`, `send-transactional-email`, `passkey-*` — scan for 4xx/5xx spikes.
3. Postgres logs — scan for permission-denied errors that would indicate the privilege revokes broke a path.

### E. Reporting

Produce a single results summary with:
- ✅ flows that work as expected
- ⚠️ anything that needs follow-up, with a concrete fix proposal
- 🔁 anything that could not be tested (e.g. requires the user to be logged in as a specific role) with instructions for the user

## Out of scope

- New security work or new findings (this is a regression check only).
- UI refactors or design changes.
- Re-running security scans (already done in the previous turn).

## Risks worth specifically watching

- **Passkey registration/auth failing on the preview origin** if the hardcoded allowlist in `webauthn-config.ts` doesn't match the current preview host. The preview hostname for this project is `id-preview--12ceecea-7754-4292-80f9-2a5ae25c91d0.lovable.app` and is in the allowlist, but if Lovable ever rotates the preview ID, this would silently break preview passkeys.
- **Email button URLs pointing to the fallback domain** even when users test from preview — this is correct behavior post-fix (no client-controlled origin), but worth flagging so it isn't mistaken for a bug.
- **`send-transactional-email` 403s** if any server caller forgot the service-role key.
