# Limit Users to 3 Passkeys

Multiple passkeys per user already work. This change enforces a hard cap of 3 — both server-side (authoritative) and client-side (UX).

## Changes

### `supabase/functions/passkey-register-verify/index.ts`
After looking up `existingCount` (already present), if it's `>= 3` return:
`json(400, { error: 'You already have the maximum of 3 passkeys. Remove one before adding another.' })`
Do this **before** running WebAuthn verification and inserting — no wasted work, no orphan challenge cleanup needed beyond what already happens.

### `supabase/functions/passkey-register-options/index.ts`
Mirror the check at options-generation time so the browser never even prompts:
- Count `user_passkeys` for this user; if `>= 3`, return `400 { error: 'Passkey limit reached (3). Remove one to add another.' }`.

### `src/components/profile/PasskeySettings.tsx`
- When `keys.length >= 3`: hide the device-name input + setup button, replace with a small muted note: *"You've reached the maximum of 3 passkeys. Remove one to add another."*
- Update the button label logic: still "Set up Passkey" when 0, "Add another passkey" when 1–2, hidden at 3.

## Validation

1. Register passkeys 1, 2, 3 from Profile — all succeed.
2. UI hides the add button after the 3rd; helper text appears.
3. Manually invoke `passkey-register-options` with a 4th attempt (curl with valid JWT) → returns 400 with the limit message.
4. Remove one passkey → add button reappears, can register again.

## Files

**Edited**
- `supabase/functions/passkey-register-options/index.ts`
- `supabase/functions/passkey-register-verify/index.ts`
- `src/components/profile/PasskeySettings.tsx`
