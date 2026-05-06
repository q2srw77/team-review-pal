## Add Dark Mode

### Overview
Add dark mode support with a toggle button in the dashboard header, persist the preference per-user in their profile, and load it on login.

### Changes

**1. Database**
- Add a `theme_preference` column to `profiles` (text, default `'light'`, allowed values: `'light' | 'dark'`).

**2. Theme provider (`src/hooks/useTheme.tsx` — new)**
- React context that:
  - Loads saved theme from `profiles.theme_preference` when the user logs in.
  - Falls back to `localStorage` (and then system `prefers-color-scheme`) when logged out.
  - Applies/removes the `dark` class on `<html>`.
  - Exposes `theme` and `toggleTheme()`. On toggle, updates state, localStorage, and (if logged in) writes to `profiles.theme_preference`.

**3. Wire provider**
- Wrap the app in `<ThemeProvider>` inside `src/App.tsx` (under `AuthProvider`).

**4. Dashboard header button (`src/pages/Dashboard.tsx`)**
- Add a ghost icon button between the Profile and Settings buttons.
- Icon: `Sun` when in dark mode (click → light), `Moon` when in light mode (click → dark), from `lucide-react`.
- Title/aria-label updates accordingly.

**5. Design tokens**
- `src/index.css` already defines `.dark` tokens for shadcn defaults, but they don't match the app's custom palette (status colors, sidebar, accent). Refine the `.dark` block so the app reads cohesively in dark mode:
  - Dark background/foreground tuned to a deep slate.
  - Keep `--primary`, `--accent`, and `--status-*` hues but adjust lightness for AA contrast on dark surfaces.
  - Card/popover/border/input/muted updated for dark.

### Notes
- No change required to other pages — they all use semantic tokens, so they will switch automatically.
- The preference is "remembered at next login" via the profile row; localStorage handles the brief pre-auth flash.