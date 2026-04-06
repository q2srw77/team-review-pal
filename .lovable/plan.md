

## Allow Admin Self-Editing

### Current restriction
- **Edge function** (`manage-user/index.ts` line ~67): blocks any action where `user_id === caller.id`
- **UI** (`Settings.tsx`): hides the dropdown menu for the current user's row

### Changes

**`supabase/functions/manage-user/index.ts`**
- Move the self-edit guard so it only applies to `delete_user` and `update_roles`, not `update_user`

**`src/pages/Settings.tsx`**
- Always show the dropdown for every row
- For the current user's row, only show "Edit User" (hide "Change Roles" and "Remove User")

