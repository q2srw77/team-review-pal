## Root cause

The registration just crashed with this error in the edge function logs:

```
passkey-register-verify TypeError: Cannot read properties of undefined (reading 'id')
    at index.ts:94:33
```

Line 94 is:
```ts
const { credential } = verification.registrationInfo
```
followed by `credential.id`, `credential.publicKey`, `credential.counter`.

That `credential: {...}` shape is the **SimpleWebAuthn v11** return shape. But all four edge functions import from `npm:@simplewebauthn/server@10`, which returns the **flat v10 shape**:
```
registrationInfo.credentialID
registrationInfo.credentialPublicKey
registrationInfo.counter
```
So `verification.registrationInfo.credential` is `undefined` → `.id` throws → 500 → "non-2xx error" in the UI. The webauthn ceremony itself succeeded (`verified: true, hasInfo: true` in the logs); we just can't read the result.

`passkey-auth-verify` has the same mismatch — it passes a v11-style `credential: { id, publicKey, counter }` to `verifyAuthenticationResponse`, which v10 doesn't accept (it expects `authenticator: { credentialID, credentialPublicKey, counter }`). That's the next failure that would surface once a passkey actually gets stored.

## Fix

Upgrade the server import from `@simplewebauthn/server@10` to `@simplewebauthn/server@11` in all four passkey edge functions. The code already matches v11's API, so no other logic changes are needed.

Also bump `@simplewebauthn/browser` in `package.json` from `"10"` to `"^11"` so client and server stay on the same major (the v10 browser bundle works against a v11 server in practice, but staying matched avoids future drift).

### Files to change

- `supabase/functions/passkey-register-options/index.ts` — change import to `@simplewebauthn/server@11`
- `supabase/functions/passkey-register-verify/index.ts` — same
- `supabase/functions/passkey-auth-options/index.ts` — same
- `supabase/functions/passkey-auth-verify/index.ts` — same
- `package.json` — bump `@simplewebauthn/browser` to `^11`

## After deploy

1. Remove any stale passkey for `reviewhub.cyphersecurity.us` from the OS/browser keychain (the previous half-registered ones never landed in our DB).
2. Sign in with password, go to Profile → Set up Passkey. The row should now persist in `user_passkeys`, and signing out and back in via passkey should succeed.

If anything still fails, the existing checkpoint logs in all four functions will pinpoint the step.
