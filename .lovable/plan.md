

## Settings Page with User Management

### Overview
Create a Settings page accessible from the dashboard header. The page will have a Users section where admins can invite new team members (by creating accounts with assigned roles) and manage existing users (view, change roles, remove).

### Architecture

**New edge function: `invite-user`**
- Accepts `{ email, password, full_name, role }` from an admin
- Server-side guard: verifies the caller is an admin via JWT + `has_role` check
- Creates user via `supabase.auth.admin.createUser` with `email_confirm: true`
- Inserts role into `user_roles`
- Returns success/error

**New edge function: `manage-user`**
- Accepts actions: `update_role` (change role), `delete_user` (remove user)
- Server-side guard: verifies caller is admin
- For role updates: deletes old roles, inserts new one
- For deletion: calls `supabase.auth.admin.deleteUser`
- Returns success/error

**Auth context update (`useAuth.tsx`)**
- Add `isAdmin` boolean derived from user_roles

**New page: `src/pages/Settings.tsx`**
- Tabbed layout; first tab is "Users"
- Users section:
  - Table listing all users (name, email, role, joined date)
  - "Invite User" button opens a dialog with fields: Full Name, Email, Password, Role (dropdown: admin, reviewer, submitter)
  - Each row has actions: change role, remove user
- Only accessible to admins; non-admins redirected to dashboard

**Dashboard header update**
- Add a Settings gear icon link (visible to admins only)

**Index.tsx routing**
- Add a `page` state or simple client-side routing to switch between Dashboard and Settings

### Files to create/modify

| File | Action |
|------|--------|
| `supabase/functions/invite-user/index.ts` | New edge function |
| `supabase/functions/manage-user/index.ts` | New edge function |
| `src/pages/Settings.tsx` | New settings page with user management |
| `src/hooks/useAuth.tsx` | Add `isAdmin` to context |
| `src/pages/Index.tsx` | Add settings page routing |
| `src/pages/Dashboard.tsx` | Add settings link in header for admins |

### Security
- All user management operations go through edge functions using the service role key
- Every edge function verifies the caller has the `admin` role server-side before proceeding
- Client-side admin check is only for UI gating; real enforcement is server-side

