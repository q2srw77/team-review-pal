

## Add Teams Section to Settings

### Database Changes

**New table: `teams`**
- `id` (uuid, PK, default gen_random_uuid())
- `name` (text, not null)
- `description` (text, not null, default '')
- `created_at` (timestamptz, default now())
- RLS: SELECT for authenticated, ALL for admins

**New table: `team_members`**
- `id` (uuid, PK, default gen_random_uuid())
- `team_id` (uuid, not null, FK to teams.id on delete cascade)
- `user_id` (uuid, not null)
- `created_at` (timestamptz, default now())
- unique(team_id, user_id)
- RLS: SELECT for authenticated, ALL for admins

### UI Changes

**`src/pages/Settings.tsx`**
- Add "Teams" to the sidebar nav (using `UsersRound` icon)
- Add section type and render `TeamManagement` component

**New: `src/components/settings/TeamManagement.tsx`**
- List view: table of teams showing name, description, member count, created date, and actions dropdown (Edit, Manage Members, Delete)
- Add/Edit dialog: name + description fields
- Delete confirmation dialog
- Manage Members dialog: shows current members with remove button, plus a dropdown/select to add users from profiles table
- Follows the same pattern as PlatformManagement (fetch, CRUD, dialogs, toasts)

### Files to modify/create

| File | Change |
|------|--------|
| New migration | Create `teams` and `team_members` tables with RLS |
| `src/components/settings/TeamManagement.tsx` | New component with full CRUD + member management |
| `src/pages/Settings.tsx` | Add "Teams" nav item and render the component |

