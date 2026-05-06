## Diagnosis

The edge-function logs and database state tell a clear story:

**From the logs** (`reviewhub.cyphersecurity.us`, `steve.weber@sophos.com`):
- `auth-options` returned `allowCount: 0` — the server found **zero** registered passkeys for this email.
- The browser still showed Touch ID anyway and sent a credential with id `voCK-CkDX...`.
- `auth-verify` looked that credential up and got `found: false` → returns **"Unknown passkey"** (400).

**From the database**:
- `user_passkeys` is **completely empty** (0 rows total).
- The profile `steve.weber@sophos.com` exists but has 0 passkeys linked.
- There are 3 stored authentication challenges and only 1 registration challenge — meaning a registration was attempted but never completed end-to-end (no row landed in `user_passkeys`).

So the failure is **not** an RP ID mismatch or a verify-step bug. The passkey simply does not exist server-side. The browser/OS keychain is happy to present a credential it has cached locally (from a previous registration attempt — possibly on the `lovableproject.com` preview domain, which has a different RP ID and therefore wouldn't match anyway), but our DB has nothing to match it to.

### Why the registration probably didn't persist

Looking at `passkey-register-verify`, the row is inserted only after `verifyRegistrationResponse` succeeds AND the password rotation succeeds. If either step failed, the registration silently doesn't save. We have no register-verify logs to confirm which (the edge function shut down before the latest attempt), so we can't tell from logs alone — but the empty `user_passkeys` table is the smoking gun.

## What to do

No code change is needed yet — the bug is operational, not in the verify path. Two-step recovery:

1. **Remove the stale OS-level credential** for `reviewhub.cyphersecurity.us` (and `team-review-pal.lovable.app` / `lovableproject.com` if any) from the device's password/passkey manager (macOS: System Settings → Passwords; Chrome: chrome://settings/passkeys). Otherwise the browser will keep offering the orphaned credential and verify will keep failing with "Unknown passkey".
2. **Re-register the passkey** while signed in on `reviewhub.cyphersecurity.us` (Profile → Passkey → Set up Passkey). After the prompt completes, we should see a new row in `user_passkeys` and `auth-options` should return `allowCount: 1`.

## If re-registration also fails

That would mean `passkey-register-verify` is rejecting or the password-rotation rollback is firing. To pinpoint it next round I'd:

- Add explicit checkpoint logs to `passkey-register-verify` (challenge lookup result, `verification.verified`, insert error, password-rotation error) — same pattern we just added to the auth functions.
- Have you retry registration so we capture a full trace.

## Files involved (no edits in this plan)

- `supabase/functions/passkey-register-verify/index.ts` — only place that writes to `user_passkeys`
- `supabase/functions/passkey-auth-options/index.ts` — confirmed returning `allowCount: 0`
- `supabase/functions/passkey-auth-verify/index.ts` — confirmed rejecting at credential lookup
