

## Multi-Role Selection for Users

Currently each user has a single role. This change will allow users to have multiple roles (e.g. both `admin` and `reviewer`).

### What changes

The database schema already supports multiple roles per user (the `user_roles` table has a `unique(user_id, role)` constraint, not a single-role constraint). So no migration is needed -- just code changes.

### Files to modify

**`src/pages/Settings.tsx`**
- Change `UserWithRole.role` from `AppRole` to `AppRole[]` (array)
- `fetchUsers`: group all roles per user instead of picking the first one
- Display multiple badges in the Role column
- **Invite dialog**: replace the single Role `Select` with a checkbox group (admin, reviewer, submitter) allowing multi-select
- **Change Role dialog**: replace single `Select` with checkbox group, pre-populated with current roles
- Update `inviteForm.role` to `roles: AppRole[]`

**`supabase/functions/invite-user/index.ts`**
- Accept `roles` (array) instead of `role` (string)
- Validate each role; insert multiple rows into `user_roles`

**`supabase/functions/manage-user/index.ts`**
- `update_role` action: accept `roles` (array) instead of `role`
- Delete existing roles, insert all new ones

**`supabase/functions/setup-admin/index.ts`**
- No change needed (already inserts both `admin` and `reviewer`)

