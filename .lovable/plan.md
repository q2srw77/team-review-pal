

## Fix: Email not showing in Users section

### Root cause

The profile for "Steve Weber" has an empty `email` field (`"email":""`). This happened because the `handle_new_user` trigger (which populates `email` from `auth.users`) was added **after** the initial admin account was created via the setup flow. The setup-admin edge function didn't store email in the profiles table.

### Fix (two parts)

**1. Backfill existing profiles** (data fix)
- Run an UPDATE via the insert tool to set profiles.email from auth.users for any profiles where email is currently empty. Since we can't query auth.users from the client, we'll use a migration with a `SECURITY DEFINER` function that copies `auth.users.email` into `profiles.email` for all rows where it's blank, then drops itself.

**2. Update `setup-admin` edge function**
- Check `supabase/functions/setup-admin/index.ts` -- if it manually inserts into profiles, ensure it includes the email field. (The trigger should handle new users going forward, but the setup-admin function may bypass the trigger by inserting directly.)

### Files to modify

| File | Change |
|------|--------|
| New migration | Backfill empty emails from auth.users |
| `supabase/functions/setup-admin/index.ts` | Ensure email is stored when creating the admin profile (if applicable) |

