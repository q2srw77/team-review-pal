## What's happening

Edge logs show your last "Set up Passkey" click hit `passkey-register-options` and got back **401 Unauthorized** — that's why the OS never prompted for a passkey (the browser ceremony is only started after we get options back).

```
POST | 401 | …/passkey-register-options   18:26:05Z
```

The toast shows nothing useful because `supabase.functions.invoke` returns a generic `FunctionsHttpError` ("Edge Function returned a non-2xx status code") and our client only reads `optsData?.error || optsErr.message` — when the response body is `{"error":"Unauthorized"}`, `optsData` is `undefined` for non-2xx, so we never see the real reason.

The 401 itself comes from this guard in `passkey-register-options`:

```ts
const { data: claims, error: claimsErr } = await anon.auth.getClaims(token)
if (claimsErr || !claims?.claims) return json(401, { error: 'Unauthorized' })
```

`auth.getClaims(token)` validates the JWT against `SUPABASE_JWKS`. The most likely causes, in order:
1. The session token was refreshed in the browser between when Profile mounted and when you clicked the button, and `functions.invoke` sent a stale token.
2. The token is valid but `getClaims` is being called wrong — the explicit `token` arg path occasionally fails when the anon client already has the Authorization header set in `global.headers`. In our other working functions we read claims without passing the token explicitly.
3. JWKS hasn't propagated for a recently rotated signing key.

## Plan

### 1. Make passkey errors actually readable (frontend)

In `src/lib/passkeys.ts`, when `functions.invoke` returns an error, read the response body off the `FunctionsHttpError` (it exposes `.context.response`) so we surface the real message instead of "non-2xx":

```ts
async function readInvokeError(err: any, fallback: string) {
  try {
    const body = await err?.context?.response?.json?.()
    if (body?.error) return body.error
  } catch {}
  return err?.message || fallback
}
```

Use it in both `registerPasskey` and `signInWithPasskey` for options + verify calls. Also surface `optsData?.error` when the function returns 200 with `{ ok: false, error }`.

### 2. Fix the 401 in `passkey-register-options`

Match the pattern we already use elsewhere — let the anon client read the token from the `Authorization` header it was constructed with, instead of passing it positionally:

```ts
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: auth } },
})
const { data: { user }, error: userErr } = await anon.auth.getUser()
if (userErr || !user) {
  console.error('register-options auth failed', userErr)
  return json(401, { error: 'Session expired. Please sign in again and retry.' })
}
const userId = user.id
const email = user.email ?? ''
```

Add a checkpoint log on entry so we can see request count / token length / failure reason on the next attempt:

```ts
console.log('register-options entry', { hasAuth: !!auth, rpID })
```

Apply the same `getUser()` pattern to `passkey-register-verify` (it has the identical guard) so registration verification doesn't hit the same wall once options succeeds.

### 3. Force a fresh session before the call (frontend, defensive)

In `PasskeySettings.handleRegister`, call `supabase.auth.refreshSession()` right before `registerPasskey(...)`. If the local session is near-expiry this guarantees `functions.invoke` sends a current token, which kills cause #1 above.

```ts
const { error: refreshErr } = await supabase.auth.refreshSession()
if (refreshErr) {
  toast.error("Your session expired. Please sign in again.")
  return
}
await registerPasskey(label.trim() || "This device")
```

### Files to change

- `src/lib/passkeys.ts` — `readInvokeError` helper, use on every `functions.invoke` error path
- `src/components/profile/PasskeySettings.tsx` — refresh session before register
- `supabase/functions/passkey-register-options/index.ts` — switch to `getUser()`, add entry log
- `supabase/functions/passkey-register-verify/index.ts` — same `getUser()` switch

### After deploy

1. Reload `/profile` (so the session loads fresh).
2. Click **Set up Passkey**. If it still fails, the toast will now show the real error string and the new `register-options entry` log will tell us whether auth got through.
