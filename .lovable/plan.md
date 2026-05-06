## Problem

When an Admin edits a user and sets a new password that fails Supabase's "leaked password" (HIBP) check, the request to `auth.admin.updateUserById` returns a 422 with the message:

> "Password is known to be weak and easy to guess, please choose a different one."

The `manage-user` edge function catches this and re-throws it as **HTTP 500**. Because `supabase.functions.invoke` treats any non-2xx response as a thrown error and discards the JSON body, the UI ends up showing the unhelpful raw runtime error:

> `Edge function returned 500: Error, {"error":"Password is known to be weak..."}`

instead of a clean toast like "Password is known to be weak..."

## Fix

Two small, targeted changes — no schema/auth config changes.

### 1. `supabase/functions/manage-user/index.ts`

For the `update_user` action (and by extension any auth/profile validation failures), return the error inside a **200 response** with `{ error: "..." }` so the client receives it via `data.error`. Specifically:

- When `supabase.auth.admin.updateUserById` returns an error (weak password, duplicate email, etc.), respond with `status: 200, body: { error: authError.message }` instead of `status: 500`.
- Do the same for the profile update branch.
- This matches the pattern already used by other validation errors in the file (e.g., the "Password must be at least 6 characters" guard returns 400 but with a clean JSON body — we'll standardize on 200 + `{error}` for validation failures so the client's `data?.error` check works uniformly).

### 2. `src/components/settings/UserManagement.tsx` (defensive)

`handleEditUser` already does `data?.error || error?.message`. Strengthen it to also unwrap `FunctionsHttpError.context` when present, so even if some other code path returns a non-2xx, the user sees the underlying message instead of "Edge function returned 500":

```ts
let message = data?.error;
if (!message && error) {
  try {
    const ctx = await (error as any).context?.json?.();
    message = ctx?.error;
  } catch { /* ignore */ }
  message = message || error.message;
}
```

Apply the same helper to `handleInvite`, `handleRoleChange`, and `handleDelete` for consistency.

## Files to modify

- `supabase/functions/manage-user/index.ts` — return validation errors as 200 + `{error}`
- `src/components/settings/UserManagement.tsx` — unwrap `FunctionsHttpError.context` so error toasts always show the real message

## Out of scope

- Not disabling the HIBP check. The leaked-password protection is a security feature and should stay on; the user simply needs a clearer message so they pick a stronger password.
