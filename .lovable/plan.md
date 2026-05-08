## Goal
Eliminate the visible light/dark "flash" that happens on initial page load and right after login, by resolving the correct theme **before** the app paints.

## Current problems

1. `getInitialTheme()` only checks `localStorage["theme-preference"]` and system preference — it never knows about the admin's app default until an async Supabase call resolves, so anonymous visitors briefly see the wrong theme.
2. On login, `user_settings.theme_preference` is fetched async after `AuthProvider` resolves the user. Until that query returns, the app shows whatever the anonymous theme was → flash.
3. `localStorage["theme-preference"]` is overwritten on every `theme` change (including the transient anonymous default), so a returning user can briefly see the previous session's theme before their own preference loads.
4. There is no inline pre-paint script in `index.html`, so even the cached value isn't applied until React mounts.

## Plan

### 1. Pre-paint inline script in `index.html`
Add a small blocking `<script>` in `<head>` that runs before React:
- Read `localStorage["theme-user-override"]` + `localStorage["theme-preference"]` (per-user saved value, keyed by user id when available — see step 3).
- Else read `localStorage["app-default-theme"]` (cached admin default).
- Else fall back to `prefers-color-scheme`.
- Toggle `document.documentElement.classList` and set a `data-theme` attribute synchronously.

This guarantees the first painted frame already has the right class.

### 2. Cache the admin default theme locally
- In `useTheme`, when the `app_settings.default_theme` query resolves, write the value to `localStorage["app-default-theme"]`.
- The pre-paint script in step 1 reads this on subsequent visits, so anonymous users only see a flash on their very first visit.

### 3. Per-user cached preference keyed by user id
- Replace single `theme-preference` key with `theme-preference:<userId>` (and keep an `anon` bucket for logged-out state).
- After login, the inline script can't know the user yet, but `useTheme` will: as soon as `useAuth` exposes `user.id`, read `theme-preference:<userId>` from localStorage **synchronously** and apply it before the Supabase round-trip. The Supabase fetch then reconciles/updates the cache.
- This removes the post-login flash for returning users.

### 4. Gate first paint until theme is resolved (only when needed)
- In `Index.tsx`, the existing loading spinner already covers `loading`. Extend `useTheme` to expose a `themeReady` boolean that becomes true when:
  - anonymous: app default + localStorage have been considered (synchronous after step 1, so effectively immediate), OR
  - authenticated: cached per-user theme exists OR Supabase fetch completed.
- `Index.tsx` keeps showing the spinner (with `bg-background` already themed) until both `auth.loading` is false AND `themeReady` is true. This eliminates flash for first-time logins where no cache exists yet.

### 5. Stop overwriting saved preference with transient values
- Only write to `theme-preference:<userId>` (or `theme-preference:anon`) inside `toggleTheme` and after a successful Supabase load — never on every `setTheme` triggered by the default-theme effect.
- Remove the blanket `localStorage.setItem(STORAGE_KEY, theme)` in the `[theme]` effect.

### 6. Clean up on sign-out
- On `signOut`, clear `USER_OVERRIDE_KEY` so the app default reapplies for the next anonymous visitor on this device.

## Files to change

- `index.html` — add inline pre-paint theme script (step 1).
- `src/hooks/useTheme.tsx` — synchronous per-user cache read, cache app default, expose `themeReady`, fix overwrite bug, sign-out cleanup (steps 2–6).
- `src/pages/Index.tsx` — wait for `themeReady` alongside `loading` before rendering the first real screen (step 4).

## Out of scope
- No DB schema changes.
- No changes to the admin Theme settings UI or per-user toggle behavior beyond the storage key rename.
- No changes to the Login screen layout.
