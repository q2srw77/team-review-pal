## Problem

The `confirm-password-reset` edge function returns errors as non-2xx HTTP responses. When the frontend calls it via `supabase.functions.invoke`, the JS SDK treats any non-2xx response as a thrown `FunctionsHttpError` — `data` is `null` and the actual error message lives on `error.context.json()`, not on `data.error`. As a result, users see a generic "Reset failed" toast instead of the real reason ("Invalid verification code", "Invalid or expired reset request", etc.), and it's hard to tell whether the password actually got updated.

There are also a few smaller correctness issues:

- `attempts` is incremented with a non-atomic read → write, so concurrent submissions can under-count.
- A bad code that lands exactly at attempt #5 returns "Invalid verification code" but does not lock the token; the next attempt slips through the `attempts >= 5` check inconsistently.
- After max attempts the token is marked `used_at` but the response still says only "Invalid verification code", which is misleading.
- The frontend doesn't surface server messages from `error.context`, and on success it routes to `/` even though the user is not signed in (Login lives at `/`, but the success state is unclear).

## Fix Plan

### 1. `supabase/functions/confirm-password-reset/index.ts`
- Always return HTTP **200** with `{ ok: false, error: "…" }` for validation/expected failures so `supabase.functions.invoke` delivers the message in `data` instead of throwing. Reserve non-2xx for true server errors (DB/auth admin failures).
- Use a single atomic update for the failed-attempt counter:
  - `update password_reset_tokens set attempts = attempts + 1, used_at = case when attempts + 1 >= 5 then now() else used_at end where id = … returning attempts, used_at` — then branch on the returned values.
- Return distinct, user-friendly errors:
  - `"This reset link is invalid or has expired."` (no row, expired, already used)
  - `"Incorrect verification code. {n} attempts remaining."` (wrong code, attempts < 5)
  - `"Too many incorrect attempts. Please request a new reset link."` (attempts hit 5 → token locked)
  - `"Could not update password. Please try again."` (admin update failure)
- Validate `newPassword` strength server-side (already present) and confirm `auth.admin.updateUserById` succeeded before marking the token used.
- After a successful password update: mark current token used AND invalidate other unused tokens for that user (already present — keep, but only do it after the password update returns no error).
- Add structured `console.log` lines for: token lookup hit/miss, attempt count, update success — to make future debugging via edge logs straightforward.

### 2. `src/pages/ResetPassword.tsx`
- Update the response handling to read both shapes:
  - If `error` is a `FunctionsHttpError`, attempt `await error.context.json()` to extract `{ error }`.
  - Otherwise read `data.ok` / `data.error`.
- Show the real server message in the toast (fallback to a generic one).
- On success: show the success toast and redirect to `/` (Login). Keep the existing redirect — Login is already mounted at `/`.
- Disable the submit button while `submitting` (already done) and also when `code.length !== 6` to reduce server round-trips.

### 3. Validation
- Manually call the deployed edge function with `supabase--curl_edge_functions` against four scenarios and confirm responses:
  1. Missing token → `{ ok: false, error: "This reset link is invalid or has expired." }` (HTTP 200)
  2. Valid token + wrong code → `{ ok: false, error: "Incorrect verification code. N attempts remaining." }` (HTTP 200)
  3. 5 wrong codes in a row → final response is the "Too many incorrect attempts" message and the row's `used_at` is set
  4. Valid token + valid code + valid password → `{ ok: true }`, and `auth.users` for that user has an updated password (verified by attempting login from the UI)
- Check `supabase--edge_function_logs` after each call to confirm the structured logs.
- Visually verify in the preview that the toast now shows the precise reason on each failure path.

## Files

**Edited**
- `supabase/functions/confirm-password-reset/index.ts`
- `src/pages/ResetPassword.tsx`

No DB schema, RLS, or other function changes are required.