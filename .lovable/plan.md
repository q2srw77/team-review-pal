## Plan: Isolate `theme_preference` with Owner-Only RLS

### Problem
The `profiles` table SELECT policy allows team members and admins to view all columns of a teammate's profile row. This means `theme_preference` is readable by non-owners, and the user wants strict owner-only access for both reading and updating.

### Solution
Extract `theme_preference` into a dedicated `user_settings` table with strict, owner-only RLS policies, then update the frontend to use this new table.

### Steps

1. **Database Migration**
   - Create a new `public.user_settings` table with:
     - `id uuid primary key default gen_random_uuid()`
     - `user_id uuid not null unique` (references no FK to avoid auth schema dependency)
     - `theme_preference text not null default 'light'`
     - `created_at`, `updated_at` timestamps
   - Enable RLS on `user_settings`.
   - Add RLS policies:
     - **SELECT**: only the owner (`auth.uid() = user_id`)
     - **INSERT**: only the owner (`auth.uid() = user_id`)
     - **UPDATE**: only the owner (`auth.uid() = user_id`)
   - Migrate existing data: copy `theme_preference` from `profiles` into `user_settings` for all rows.
   - Remove `theme_preference` from `profiles` (or leave it unused if we want to avoid breaking other code).

2. **Frontend Update**
   - Update `src/hooks/useTheme.tsx`:
     - On load: query `user_settings` instead of `profiles`.
     - On toggle: update `user_settings` instead of `profiles`.
   - No other files need changes since the `useTheme` hook is the only consumer.

3. **TypeScript Types**
   - The Supabase types file (`src/integrations/supabase/types.ts`) will auto-update after migration; no manual edits needed.

### Security Outcome
- `theme_preference` is stored in a table where the RLS `SELECT` and `UPDATE` policies enforce `auth.uid() = user_id`.
- Admins and teammates can no longer read or modify another user's theme preference.
- The `useTheme` hook continues to work transparently.
