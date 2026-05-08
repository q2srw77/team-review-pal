## Plan: Admin-Configurable Default Theme

### Goal
Add a "Theme" section in Settings where admins can set the **default theme** (light/dark) for the Review Hub app and Login screen. Authenticated users can still override it with their own preference, which continues to persist in `user_settings`.

### Steps

1. **Database — new `app_settings` table**
   - Single-row keyed table for app-wide configuration:
     - `key text primary key`, `value jsonb`, `updated_at`, `updated_by`
   - Seed row: `('default_theme', '"light"')`
   - RLS:
     - SELECT: `true` (anonymous + authenticated) — needed so the Login screen can read the default before sign-in
     - INSERT/UPDATE: admins only (`has_role(auth.uid(), 'admin')`)

2. **Frontend — `useTheme` hook update**
   - On mount (no user yet): fetch `default_theme` from `app_settings` and apply if no `localStorage` override exists.
   - On user login: if `user_settings.theme_preference` exists, it wins; otherwise fall back to the app default.
   - Toggling theme still upserts the user's personal preference (existing behavior).
   - Resolution order: user setting → localStorage → app default → system preference.

3. **Frontend — Settings: new "Theme" section (admin only)**
   - Add `Theme` nav item in `src/pages/Settings.tsx` (icon: `Palette` or `SunMoon`).
   - New component `src/components/settings/ThemeSettings.tsx`:
     - Radio/Select for "Default theme": Light / Dark
     - Save button → updates `app_settings` row for `default_theme`
     - Small note: "Users can override this in their own profile."
   - Gated by `isAdmin` from `useAuth`.

4. **Login screen**
   - No changes required: `ThemeProvider` wraps the app in `App.tsx`, so the default fetched in step 2 is applied before login.

### Out of scope
- No change to per-user override behavior or the existing dark-mode toggle in the Dashboard header.
- No audit log entry for theme change (can be added later if needed).
