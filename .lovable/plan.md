## Goal

Audit the auth surface (passkey + password + recovery flows, edge functions, RLS) and close any gap that lets an unauthenticated or under-privileged user read or modify data they shouldn't.

## What I reviewed

- All `passkey-*`, `request-password-reset`, `confirm-password-reset`, `account-recovery-passkeys`, `manage-user`, `invite-user`, `setup-admin`, `write-audit-log`, `check-setup-status` edge functions.
- RLS on every table (`profiles`, `user_roles`, `user_passkeys`, `passkey_challenges`, `review_requests`, `review_statuses`, `request_notes`, `audit_logs`, `password_reset_tokens`, etc.) and storage policies on `review-reports`.
- Client gating (`Index.tsx`, `useAuth`) and the login flow.

## What is already solid (no change)

- All sensitive tables have RLS and admin-only routes are gated by `isAdmin`.
- `manage-user`, `invite-user`, `setup-admin`, `write-audit-log` all validate the caller JWT and check admin / first-run before using the service role.
- `passkey-register-options/verify` require a Bearer token and call `auth.getUser()` before issuing a challenge / saving a credential.
- First-passkey enrolment rotates the Supabase password to random bytes, so password sign-in is enforced at the auth layer (not just UI).
- `request-password-reset` returns a generic 200 in every branch (no enumeration), rate-limits to 3 / 15 min, hashes both the link token and the 6-digit code, expires in 2 h, and locks after 5 wrong codes.
- `profiles` SELECT is restricted to self / same-team / admin — anon cannot read `password_disabled` or emails (the unauth lookup in `Login.handleContinue` simply returns null, which is the safe default).
- Storage `review-reports` is private and team-scoped.

## Issues to fix

### 1. Passkey auth options leak per-email credential metadata (high)

`supabase/functions/passkey-auth-options/index.ts` is called unauthenticated and, when given an email, returns the exact `credential_id` list and transports for that user. Two problems:
- **Account enumeration**: a non-empty `allowCredentials` confirms the email exists and has passkeys.
- **Credential ID disclosure**: credential IDs are unique per device and shouldn't be handed out to anonymous callers.

Fix: stop trusting the client-supplied email. Always return options with an empty `allowCredentials` (resident-key / discoverable-credential flow — which is what we already prefer with `residentKey: 'preferred'`). The browser will pick the matching passkey locally; `passkey-auth-verify` already looks up the credential server-side by `credential_id`, so nothing else changes.

### 2. `account-recovery-passkeys` audit log insert is broken (medium)

The function inserts into `audit_logs` with columns `actor_user_id`, `target_type`, `target_id`, `metadata`, but the table has `user_id`, `entity_type`, `entity_id`, `details`, `user_name`. The insert silently fails inside `try/catch`, so passkey wipes are not audited.

Fix: rewrite the insert to use the correct columns and a valid `action` value (extend `VALID_ACTIONS` or insert directly with service role using a new action like `passkeys_recovered`). Add `passkeys_recovered` and `password_recovered` to the audit log allow-list and switch this function to the same shape `write-audit-log` uses.

### 3. Reviewers can rewrite sensitive columns on `review_requests` (medium — supabase_lov finding)

Current UPDATE policy on `review_requests` only checks the row, not which columns are touched. A reviewer could `update review_requests set submitted_by = …, team_id = …, status = 'completed'` for any request they're assigned to.

Fix: split into two UPDATE policies / use a `BEFORE UPDATE` trigger that rejects non-reviewer column changes when the editor is not the submitter or admin. Concretely, a trigger that raises if a non-admin / non-submitter attempts to change any of: `submitted_by`, `team_id`, `title`, `platform`, `url_location`, `complete_by`, `closed_reason`, `report_pdf_path`. Reviewers should only be able to touch `notes` and `status` indirectly via `review_statuses` (which already has its own narrow policy).

### 4. Submitters can delete reviewer-authored notes (medium — agent_security finding)

DELETE policy on `request_notes` lets the request submitter delete every note on their request, including reviewer feedback. Replace with: author-only or admin-only delete.

```sql
DROP POLICY "Authenticated can delete own request notes" ON public.request_notes;
CREATE POLICY "Authors or admins can delete notes" ON public.request_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));
```

### 5. `passkey-auth-verify` returns a magic-link `token_hash` to anonymous callers (low — defensive hardening)

Today, after a successful WebAuthn assertion, the function calls `auth.admin.generateLink({ type: 'magiclink' })` and returns `token_hash` in the response, which the browser exchanges with `verifyOtp`. This works, but it means any bug that lets the verify step succeed without a real assertion immediately yields a session for an arbitrary user.

Fix (defence-in-depth): keep the current shape, but additionally (a) require the caller to send back the `credential_id` in `body.credentialId` and assert it matches `response.id`, and (b) bind the issued magic-link to a single short TTL (≤ 5 min) usage record stored in `passkey_challenges` so a token issued for user A cannot be replayed for user B if the response is intercepted in transit. (HTTPS already protects this, but the link is reusable for its TTL otherwise.)

If this feels over-scoped, drop step 5 — it's hardening, not an active vulnerability.

## Out of scope

- UI / styling.
- Email template content.
- Performance tuning.

## Files / migrations

- `supabase/functions/passkey-auth-options/index.ts` — remove email-based credential lookup, always empty `allowCredentials`.
- `supabase/functions/account-recovery-passkeys/index.ts` — fix audit log insert.
- `supabase/functions/write-audit-log/index.ts` — extend `VALID_ACTIONS`.
- New migration:
  - replace `request_notes` DELETE policy,
  - add `BEFORE UPDATE` trigger on `review_requests` restricting reviewer-editable columns.
- Optionally `supabase/functions/passkey-auth-verify/index.ts` for hardening (#5).

## Verification

After implementing, I'll re-run the security scan and the Supabase linter, and manually check:
1. Anonymous call to `passkey-auth-options` with a known email no longer returns credential IDs.
2. A reviewer account cannot `UPDATE review_requests SET team_id = …` on an assigned row (trigger raises).
3. Submitter cannot delete a note authored by another user.
4. Passkey recovery now produces an `audit_logs` row.
