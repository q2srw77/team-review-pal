

The fix is straightforward: lock down `auto-close-overdue-requests` so only the cron scheduler (using the service-role key) can invoke it.

## Plan: Restrict Auto-Close to Service Role Only

### Changes

**1. `supabase/functions/auto-close-overdue-requests/index.ts`**
Add an auth gate at the top of the handler (after the OPTIONS preflight):
- Require `Authorization: Bearer <token>` header.
- Decode JWT claims and verify `role === 'service_role'`.
- Return 401 if missing, 403 if not service role.
- Keep the rest of the function (service-role client, overdue scan, close + email) unchanged.

**2. `supabase/config.toml`**
Flip `[functions.auto-close-overdue-requests]` from `verify_jwt = false` to `verify_jwt = true` for defense-in-depth (rejects unauth calls before they hit our handler).

**3. Verify cron job**
The existing pg_cron job that calls this function already uses the service-role key bearer token (matches the pattern used for `send-review-reminders`). No change needed — but I'll confirm by reading `cron.job` during implementation. If it's using the anon key, I'll update it via the insert tool to use the service-role key from Vault.

**4. Apply the same hardening to `send-review-reminders`**
This function has the identical pattern (`verify_jwt = false`, no auth check, cron-only intended caller). Adding the same service-role gate prevents the same class of abuse (spam reminder emails). Same two changes: in-code role check + `verify_jwt = true`.

**5. Mark security finding `auto_close_no_auth` as fixed.**

### Files Modified
- `supabase/functions/auto-close-overdue-requests/index.ts`
- `supabase/functions/send-review-reminders/index.ts`
- `supabase/config.toml`
- Cron job update via insert tool (only if currently using anon key)

### Out of Scope
- The other two scanner findings (submitter-deletes-notes, user_roles privilege-escalation note) are separate issues — happy to tackle next if you want.

