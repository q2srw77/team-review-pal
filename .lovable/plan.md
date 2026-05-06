# Diagnose passkey sign-in failure

You authenticated with the passkey (the OS prompt succeeded), so the failure is happening server-side in `passkey-auth-verify` (or in the magic-link mint step). Today the client throws a generic "non-2xx" error and the server only logs at the `catch` boundary, so we can't see which guard rejected the request.

## Plan

### 1. Surface the real server error in the client
In `src/lib/passkeys.ts`, `signInWithPasskey()` currently throws `optsErr.message` / `verifyErr.message`, which for `supabase.functions.invoke` is just `"Edge Function returned a non-2xx status code"`. Update both invoke calls to also read `data?.error` (the JSON body is delivered even on non-2xx) and prefer that message in the thrown `Error`. Same fix for `registerPasskey` for symmetry.

### 2. Add checkpoint logs to `passkey-auth-verify`
Insert `console.log` statements at each decision point so the next failure tells us exactly which branch fired:
- after parsing body: log `{ rpID, origin, hasResponse, credentialId }`
- after challenge lookup: log `{ found, expired, used }`
- after credential lookup: log `{ found, userId }`
- after `verifyAuthenticationResponse`: log `{ verified, newCounter }`
- before `generateLink`: log `{ email }`; on error log full `linkErr`

### 3. Add checkpoint logs to `passkey-auth-options`
- log `{ email, rpID, allowCount }` so we can confirm the credential list isn't empty

### 4. Re-test and read logs
After deploy, retry sign-in on `reviewhub.cyphersecurity.us`. The next message will include edge-function logs that pinpoint the failing branch (most likely candidates: `Unknown passkey` due to a credential_id encoding mismatch, `Verification failed` due to RP ID mismatch on the custom domain, or `generateLink` failing).

### 5. Fix based on findings
Ship the targeted fix in a follow-up turn once the logs identify the branch. No speculative changes now.

## Files touched
- `src/lib/passkeys.ts` — better error extraction
- `supabase/functions/passkey-auth-verify/index.ts` — checkpoint logs
- `supabase/functions/passkey-auth-options/index.ts` — checkpoint logs

No DB or schema changes.