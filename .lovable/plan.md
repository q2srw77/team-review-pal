# Server-Side Enforcement of Passkey-Only Sign-In

## Problem

Today, after registering a passkey we set `profiles.password_disabled = true` and the Login page refuses to call `signInWithPassword` for that account. But the user's Supabase password is still valid — anyone hitting `auth.signInWithPassword` directly (curl, another client, an old tab) can still log in. The flag is advisory, not enforcement.

## Fix

When a user registers their **first** passkey, rotate their Supabase password to a cryptographically random value that is never returned to the client. Password sign-in then fails at Supabase Auth itself, regardless of which client makes the request. The `password_disabled` flag stays for UI hints (show "this account uses a passkey" message, hide the Change Password card).

When the user removes their **last** passkey, they cannot recover the random password. They use the existing **Forgot Password** flow to set a new one — which already works end-to-end. We surface this clearly in the removal confirmation dialog.

## Changes

### `supabase/functions/passkey-register-verify/index.ts`
After the credential is inserted successfully, check whether this is the user's first passkey. If so:
1. Generate 48 bytes of randomness, base64-encode → use as new password.
2. Call `admin.auth.admin.updateUserById(userId, { password: randomPassword })`.
3. Then set `profiles.password_disabled = true` (already done).
4. If the password rotation fails, roll back: delete the just-inserted passkey row and return an error so the user isn't locked out with a passkey we can't fully enforce.

If a passkey already existed before this registration, skip rotation (password is already random from the first enrollment).

### `src/components/profile/PasskeySettings.tsx`
Update the "Remove passkey" confirmation dialog when removing the last passkey:
> "This is your only passkey. Removing it means you'll need to use **Forgot Password** on the sign-in screen to set a new password before you can sign in again."

Also, when the last passkey is deleted from the client, we currently flip `password_disabled` back to false. Keep that — it lets the UI show the password reset path normally — but make it clear in the toast that the user must reset their password to sign in with a password again.

### `src/pages/Login.tsx`
The existing client-side `password_disabled` check stays as a friendly UX hint (avoids a confusing "invalid credentials" error). No change needed here.

### No DB migration
Schema is already correct.

## Validation

1. Register a passkey from Profile. Confirm in Cloud → Users that the user's `encrypted_password` updated_at advanced.
2. Sign out. Try `signInWithPassword` with the original password via the UI → fails with the friendly "use your passkey" toast (client check).
3. Bypass the client: open devtools and run `await window.supabase?.auth.signInWithPassword(...)` (or curl the auth endpoint) with the old password → Supabase returns `invalid_credentials`. Real enforcement confirmed.
4. Sign in with passkey → succeeds.
5. Register a second passkey → password is NOT rotated again (verify edge logs).
6. Remove both passkeys. Try password login → still fails. Use Forgot Password → set new password → sign in works.
7. Check `supabase--edge_function_logs` for `passkey-register-verify`: structured logs show "first passkey, rotating password" vs "additional passkey, skipping rotation".

## Files

**Edited**
- `supabase/functions/passkey-register-verify/index.ts`
- `src/components/profile/PasskeySettings.tsx`
