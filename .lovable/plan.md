## Problem

When an admin deletes a user via `manage-user` (action `delete_user`), only `team_members`, `user_roles`, `profiles`, and the auth user are removed. Rows in `review_statuses` for that user (and related rows) are left behind. Because the deleted user's pending `review_status` never moves to `completed`, the request stays in `pending` / `in_review` and only auto-advances when the deadline is reached. In the UI the orphaned reviewer renders as "Unknown".

## Fix

Update `supabase/functions/manage-user/index.ts` `delete_user` branch so that, before deleting the auth user, it also cleans up everything tied to the user and unblocks affected review requests.

### Steps inside `delete_user`

1. Collect the set of `request_id`s where the deleted user currently has a `review_statuses` row (these are the requests whose status may need to be recomputed).
2. Delete the deleted user's rows from:
   - `review_statuses` (removes the blocking "Unknown" reviewer entirely — cleaner than leaving an orphaned row)
   - `review_reminders_sent` (by `reviewer_id`)
   - `request_notes` (by `author_id`) — or, safer, reassign to NULL is not possible since `author_id` is NOT NULL, so delete the notes authored by the removed user (these would otherwise also render as "Unknown")
   - `user_passkeys`, `user_settings`, `passkey_challenges` (by `user_id`)
3. For each affected `request_id` collected in step 1, recompute the request status using the same logic as the `auto_update_request_status` trigger:
   - Count remaining `review_statuses` rows: `total`, `completed`, `in_review`.
   - Only touch requests whose current status is `pending` or `in_review` (don't override `correction` / `completed`).
   - If `total > 0 AND completed = total` → set to `correction` (all remaining reviewers done).
   - Else if `in_review > 0 OR completed > 0` → `in_review`.
   - Else → `pending`.
   - If `total = 0` (deleted user was the only reviewer), set to `correction` so the submitter can act, mirroring the auto-close behavior. (Alternative: leave as `pending`; chosen `correction` to avoid stuck requests with no reviewers.)
4. Continue with existing deletes (`team_members`, `user_roles`, `profiles`) and `auth.admin.deleteUser`.
5. Write an `audit_logs` entry with the deleted user's id, the count of affected requests, and the request ids, action `deleted_user_cleanup`.

### Step 3 implementation note

Do the recompute server-side with the service-role client (loops over affected requests with one small `select` + one `update` each). No SQL function is added; keeping it in TypeScript matches the rest of `manage-user`. If you prefer a single DB round-trip, we can add a `public.recompute_request_status(uuid)` SECURITY DEFINER function in a follow-up — not required for the fix.

### What is NOT changed

- `auto_update_request_status` trigger and other DB logic stay as-is.
- `review_statuses` table schema stays as-is (no FK to auth.users, so no cascade option without a migration; explicit cleanup in the edge function is sufficient).
- UI "Unknown" fallback stays as a defensive label for any genuinely missing profile.
- Submitters who are deleted: `review_requests.submitted_by` rows will be left intact (admin can decide whether to delete). Out of scope for this fix unless you want it included — let me know.

## Files touched

- `supabase/functions/manage-user/index.ts` — extend `delete_user` branch (steps 1–5 above).

## Verification

- Delete a user who has a pending review on an active request → request status updates immediately; reviewer no longer appears as "Unknown"; if all other reviewers were already completed, request flips to `correction`.
- Delete a user with no review assignments → unchanged behavior.
- Re-deploy `manage-user`.
