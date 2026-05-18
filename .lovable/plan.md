## Goal

Remove existing `review_statuses` rows belonging to deleted users (rendered as "Unknown" in the UI) and unblock any request that was stuck because of them.

## Current orphans

A scan of `review_statuses` left-joined to `profiles` returns 3 orphaned rows across 3 requests:

| request_id | reviewer_id | rs.status | request.status |
|---|---|---|---|
| 74abad39…f26a6 | 32835790… | completed | completed |
| 1378de1f…02ff | e0ade53d… | completed | completed |
| 53d271fd…9767a | e0ade53d… | pending   | in_review |

Only `53d271fd…` is still active. Its remaining reviewers after cleanup: 1 pending + 2 completed → recomputed status stays `in_review` (the other two completed reviewers were already counted, the orphan was the only blocker beyond `a8589a90…`, who is still pending). The two completed requests need no recompute.

## Changes (one migration, data-only)

1. Delete the 3 orphaned `review_statuses` rows: `DELETE FROM review_statuses rs WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = rs.reviewer_id);`
2. Also clean orphans in related tables for consistency:
   - `review_reminders_sent` where `reviewer_id` has no profile
   - `request_notes` where `author_id` has no profile (these would also render "Unknown")
   - `user_passkeys`, `user_settings`, `passkey_challenges` where `user_id` has no profile
3. Recompute `review_requests.status` for any affected request whose current status is `pending` or `in_review`, using the same rules as `auto_update_request_status`:
   - `total = 0` → `correction`
   - `completed = total` → `correction`
   - `in_review > 0 OR completed > 0` → `in_review`
   - else → `pending`
4. Insert one `audit_logs` row summarizing the cleanup (action `orphan_reviewer_cleanup`, counts, affected request ids).

No code or schema changes — the existing edge function already handles future deletions correctly; this only fixes the historical data.

## Verification

After the migration:
- `SELECT count(*) FROM review_statuses rs LEFT JOIN profiles p ON p.user_id=rs.reviewer_id WHERE p.user_id IS NULL;` → 0
- Request `53d271fd…` opens without an "Unknown" reviewer and remains `in_review` until `a8589a90…` completes.
- The two `completed` requests are unchanged.
