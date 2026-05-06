# Forgot Password with Two-Factor Reset

Add a secure password reset flow on the login screen. Users enter their email, receive an email containing both a secure reset link and a 6-digit verification code, and must provide BOTH (the link's token + the code) along with a new password to complete the reset. Tokens expire after 2 hours.

## User Flow

1. On the Login screen, user clicks **"Forgot password?"**.
2. User enters their email and clicks **Send reset link**.
   - Always shows a generic success message (no account-existence leak).
3. User receives a branded email with:
   - A **"Reset password"** button (secure link with a one-time token)
   - A **6-digit verification code** displayed in the email body
   - A note: "This link and code expire in 2 hours."
4. User clicks the link → opens `/reset-password?token=...` page.
5. Page asks for: **Verification code** (6 digits) + **New password** + **Confirm password**.
6. On submit, backend validates token + code + password strength, updates the password, marks token used, and signs the user in (or sends them to login).

## UI Changes

- **`src/pages/Login.tsx`**: Add a "Forgot password?" link below the password field that switches to a `ForgotPasswordForm` view (inline state — no new route).
- **New `src/components/ForgotPasswordForm.tsx`**: Email input + Send button + Back to login. Always shows generic confirmation toast.
- **New `src/pages/ResetPassword.tsx`**: Reads `token` from URL query, shows fields for code (using `InputOTP`), new password, confirm password. Validates with zod (min 8 chars, mixed case, number). On success, redirects to login with success toast.
- **Routing**: Add `/reset-password` route in `src/App.tsx` (public, before the auth-gated `/`).

## Backend Changes

### New table `password_reset_tokens`
```
id uuid pk
user_id uuid (FK auth.users, cascade)
token_hash text         -- sha256 of the link token (never store plain)
code_hash  text         -- sha256 of the 6-digit code
expires_at timestamptz  -- now() + 2 hours
used_at    timestamptz  -- null until consumed
attempts   int default 0
created_at timestamptz default now()
```
RLS: enabled, no policies (service-role only access from edge functions).

Validation trigger (not CHECK): ensure `expires_at > created_at`.

### New edge function `request-password-reset` (verify_jwt = false)
- Input: `{ email }` (zod-validated).
- Looks up user by email via service role admin API.
- If found: generates secure random token (32 bytes, base64url) + 6-digit code, stores hashes with `expires_at = now() + 2h`, invalidates prior unused tokens for that user.
- Enqueues a transactional email using existing `send-transactional-email` infra with new template `password-reset`.
- Always returns `{ ok: true }` regardless (prevents user enumeration).
- Rate limit: max 3 requests per email per 15 minutes (tracked in same table).

### New edge function `confirm-password-reset` (verify_jwt = false)
- Input: `{ token, code, newPassword }` (zod).
- Hashes token, looks up row; verifies not used, not expired, attempts < 5, code matches.
- On mismatch: increments `attempts`; on 5 failed attempts marks token used.
- On success: calls `auth.admin.updateUserById` to set new password, marks `used_at`, invalidates other tokens for the user.
- Returns generic errors ("Invalid or expired reset request").

### New email template `password-reset`
- Add to `supabase/functions/_shared/transactional-email-templates/` and register in `registry.ts`.
- Contains: greeting, **Reset Password** CTA button (link to `${APP_URL}/reset-password?token=...`), the 6-digit code in a prominent monospace block, expiry notice ("Expires in 2 hours"), and a "didn't request this?" footer.
- Uses Review Hub branding consistent with other templates.

## Security Notes

- Tokens & codes stored only as SHA-256 hashes.
- Two-factor: link token (something you have via email access) + numeric code (still requires email access — provides an extra check against link prefetching by mail scanners).
- 2-hour expiry, single use, attempt limit, per-user invalidation on success.
- Generic responses prevent user enumeration and detail leaks.
- Strong password policy enforced client + server-side via zod.
- Service-role usage confined to these two functions; aligns with existing project security memory.

## Files Summary

**New**
- `src/components/ForgotPasswordForm.tsx`
- `src/pages/ResetPassword.tsx`
- `supabase/functions/request-password-reset/index.ts`
- `supabase/functions/confirm-password-reset/index.ts`
- `supabase/functions/_shared/transactional-email-templates/password-reset.tsx`

**Edited**
- `src/pages/Login.tsx` (add Forgot password? link)
- `src/App.tsx` (add `/reset-password` route)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (register template)
- `supabase/config.toml` (verify_jwt = false for both new functions)
- DB migration: `password_reset_tokens` table + validation trigger
