# Add Passkey Authentication

Passkeys (WebAuthn / FIDO2) let users sign in with Touch ID, Face ID, Windows Hello, or a hardware key instead of a password. Lovable Cloud's auth does not support passkeys natively, so we build it on top using two edge functions and the browser's WebAuthn API. Once a user enrolls a passkey, password sign‑in is disabled for that account.

## User Experience

**My Profile → new "Passkey" card**
- If no passkey: "Set up Passkey" button. Click → browser prompts for biometrics/security key → success toast. A warning is shown first: *"After setup, you'll sign in with your passkey instead of a password."*
- If a passkey exists: shows device label, created date, last used date. Buttons: "Add another passkey", "Remove passkey".
- Removing the last passkey re-enables password sign‑in (with a confirmation dialog).
- The existing "Change Password" card is hidden once any passkey is registered.

**Login screen**
- Email field + two buttons: **"Sign in with Passkey"** (primary) and **"Use password"** (secondary).
- Flow: user types email → clicks Passkey → browser shows passkey picker → signed in.
- If the email has a passkey registered, password sign-in returns: *"This account uses a passkey. Please sign in with your passkey."*
- "Forgot password?" stays available, but if the account has a passkey it triggers the passkey reset path (request a new passkey enrollment via emailed magic link instead of password reset).

## Architecture

```text
Browser (WebAuthn API)
   │  navigator.credentials.create() / .get()
   ▼
Edge Functions (public, no JWT)
   ├── passkey-register-options   → returns challenge + user info
   ├── passkey-register-verify    → stores credential, disables password
   ├── passkey-auth-options       → returns challenge + allowCredentials
   └── passkey-auth-verify        → verifies signature, mints Supabase session
   ▼
DB: user_passkeys, passkey_challenges
```

Library: `@simplewebauthn/server` (Deno-compatible) for challenge generation and signature verification. Browser side: `@simplewebauthn/browser`.

## Database Changes

New table `user_passkeys`:
- `id uuid pk`, `user_id uuid`, `credential_id text unique`, `public_key bytea`, `counter bigint`, `transports text[]`, `device_label text`, `created_at`, `last_used_at`
- RLS: users can SELECT/DELETE their own; service role manages all writes.

New table `passkey_challenges` (short-lived, 5 min):
- `id uuid pk`, `user_id uuid nullable`, `email text nullable`, `challenge text`, `type text` (`registration`|`authentication`), `expires_at`, `used_at`
- RLS: service role only.

New column on `profiles`: `password_disabled boolean default false`. When true, the password sign‑in path returns the friendly "use your passkey" error.

## Sign-in Flow (how the session is created)

WebAuthn verifies cryptographically that the user owns the private key. Once verified server-side, the edge function uses the service role to issue a Supabase session for that user via `auth.admin.generateLink({ type: 'magiclink' })` and then exchanges the resulting OTP/token for a session that the client stores. Alternative if cleaner: `auth.admin.createSession()` style — confirm during implementation which Supabase admin call yields a usable session token in the current SDK version. The choice is internal; UX is unchanged.

## Files

**New**
- `supabase/migrations/<ts>_add_passkeys.sql` — tables, RLS, `password_disabled` column.
- `supabase/functions/passkey-register-options/index.ts`
- `supabase/functions/passkey-register-verify/index.ts`
- `supabase/functions/passkey-auth-options/index.ts`
- `supabase/functions/passkey-auth-verify/index.ts`
- `src/components/profile/PasskeySettings.tsx` — card for My Profile.
- `src/components/PasskeyLoginButton.tsx` — used on Login.
- `src/lib/passkeys.ts` — browser-side helpers wrapping `@simplewebauthn/browser`.

**Edited**
- `src/pages/Profile.tsx` — mount `PasskeySettings`, hide password card when passkey exists.
- `src/pages/Login.tsx` — add passkey button, show "use passkey" message when applicable.
- `src/components/ForgotPasswordForm.tsx` — branch when account is passkey-only.
- `supabase/config.toml` — `verify_jwt = false` for the four new functions (register/options public; verify functions validate the user's JWT or the registration challenge themselves).
- `supabase/functions/setup-admin/index.ts` — no change needed.

**Dependency**
- Add `@simplewebauthn/browser` to the frontend (`bun add`).

## Validation

1. Enroll a passkey from Profile on desktop Chrome and iOS Safari; confirm row in `user_passkeys`, `password_disabled = true`.
2. Sign out, sign in with passkey on Login; session is created and Dashboard loads.
3. Try password sign‑in for the same account → see "use your passkey" message.
4. Add a second passkey from another device; both listed in Profile.
5. Remove the last passkey → password sign‑in works again.
6. Confirm `passkey_challenges` rows expire / are marked `used_at` after each ceremony.
7. Run `supabase--linter` and check edge logs are clean.

## Open Questions

1. **Recovery if a user loses their only passkey:** options are (a) email magic link that lets them enroll a new passkey, (b) keep password as a fallback always. The plan above assumes (a). Confirm preference.
2. **Allow both passkey + password simultaneously?** Spec says passkey *replaces* password — implemented as such. Can be relaxed later.
