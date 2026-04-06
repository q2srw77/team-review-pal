

## Initial Setup Flow

When no users exist in the system, show a one-time setup screen instead of the login form. This lets the first user create an admin account. Once any user exists, the setup is permanently locked out.

### How it works

1. **Check for existing users** -- On the Login/Index page, before rendering, call a backend function that counts rows in `profiles`. If zero, show the setup screen; otherwise show login.

2. **Database: create a secure edge function** -- `check-setup-status` edge function that queries `profiles` count (using service role key, since no user is authenticated yet). Returns `{ needsSetup: true/false }`.

3. **Database: create a `setup-admin` edge function** -- Accepts name, email, password. Uses the service role key to:
   - Re-verify `profiles` count is 0 (server-side guard -- prevents re-running)
   - Create the user via `supabase.auth.admin.createUser`
   - Insert an `admin` + `reviewer` role in `user_roles`
   - Return success

4. **UI: `SetupForm` component** -- Shown when `needsSetup` is true. Fields: Full Name, Email, Password, Confirm Password. On submit, calls the `setup-admin` edge function, then auto-signs in.

5. **Index page update** -- Add a loading state that checks setup status first, then routes to either SetupForm or Login.

### Files to create/modify

| File | Action |
|------|--------|
| `supabase/functions/check-setup-status/index.ts` | New edge function |
| `supabase/functions/setup-admin/index.ts` | New edge function |
| `src/components/SetupForm.tsx` | New setup UI component |
| `src/pages/Index.tsx` | Add setup status check |

### Security

- The `setup-admin` function always re-checks `profiles` count server-side before creating the user, so it can never be called after the first user exists.
- Both edge functions use the service role key (already available as a secret) for admin operations.

