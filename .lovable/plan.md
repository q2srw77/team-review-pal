## Problem

When an admin deletes a user, the `manage-user` edge function only removes the row from `user_roles` and the auth user. It does **not** remove the user's `team_members` rows, so the team continues to list a member whose profile/auth record no longer exists — appearing as "unknown user". The `profiles` row is also orphaned.

## Fix

Update the `delete_user` branch of `supabase/functions/manage-user/index.ts` to clean up all related rows before deleting the auth user:

```ts
await supabase.from("team_members").delete().eq("user_id", user_id);
await supabase.from("user_roles").delete().eq("user_id", user_id);
await supabase.from("profiles").delete().eq("user_id", user_id);
const { error } = await supabase.auth.admin.deleteUser(user_id);
```

Notes:
- `profiles` currently has no DELETE policy, but the edge function uses the service-role client which bypasses RLS, so this works without policy changes.
- No schema migration needed — purely a server-side cleanup change.
- `review_requests.submitted_by` and `review_statuses.reviewer_id` are **not** cascaded; deleting those would destroy historical review data. We leave those alone (they will continue to reference the deleted auth id, but the team-member listing — which is the user-visible bug — will be clean).

## Files to modify

- `supabase/functions/manage-user/index.ts` — add `team_members` and `profiles` deletes inside the `delete_user` action.
