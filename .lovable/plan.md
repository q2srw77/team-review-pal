

## Add User Profile Page

### Overview
Add a "Profile" page accessible from the dashboard header (via a user icon button next to the settings gear). The page shows the user's name, email, role badges, team memberships (read-only), and a password change form.

### Changes

#### 1. New file: `src/pages/Profile.tsx`
- Display user's name and email (from `useAuth` + profiles table)
- Display role badges (from `useAuth`)
- Fetch and display team memberships: query `team_members` joined with `teams` for the current user, render as a read-only list (team name + description)
- Password change form: current password field (not strictly needed by Supabase but good UX), new password, confirm new password. On submit call `supabase.auth.updateUser({ password: newPassword })`. Show success/error toast.
- Back button to return to dashboard

#### 2. Update `src/pages/Index.tsx`
- Add `"profile"` to the page state union type
- Render `<Profile onBack={() => setPage("dashboard")} />` when `page === "profile"`
- Pass `onNavigateProfile` callback to `Dashboard`

#### 3. Update `src/pages/Dashboard.tsx`
- Accept new prop `onNavigateProfile?: () => void`
- Add a `User` icon button in the header (next to profileName) that calls `onNavigateProfile`

### Technical Details
- Password update uses `supabase.auth.updateUser({ password })` — no edge function needed
- Team list query: `supabase.from("team_members").select("team_id, teams(name, description)").eq("user_id", user.id)`
- RLS already allows users to see their own team memberships
- No database changes required

### Files Modified
- `src/pages/Profile.tsx` (new)
- `src/pages/Index.tsx`
- `src/pages/Dashboard.tsx`

