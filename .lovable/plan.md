## Goal

When a reviewer posts their first note on a request, automatically flip their reviewer status from `pending` to `in_review`. This causes the existing `auto_update_request_status` trigger to promote the request itself to **In Review**, so no separate request-level update is needed.

## Scope

Frontend-only change in `src/components/RequestDetail.tsx`. No DB schema, RLS, or edge function changes — the existing reviewer-status UPDATE policy and the existing status trigger already cover this path.

## Change

In `addNote` (around line 458), after the `request_notes` insert succeeds and before `fetchNotes()`:

1. Find the current user's row in the already-loaded `reviewerStatuses` state.
2. If it exists and its `status === "pending"`, call the same update used by `updateMyReviewStatus`:
   - `UPDATE review_statuses SET status='in_review', updated_at=now() WHERE request_id=? AND reviewer_id=?`
   - Fire the `write-audit-log` invocation with `action: "review_status_changed"`, `new_status: "in_review"` (mirroring the existing manual-change path so audit history stays consistent).
3. Call `fetchReviewerStatuses()` and `onUpdated()` so the badge, reviewer list, and parent dashboard reflect the new status immediately.

If the reviewer's status is already `in_review` or `completed`, do nothing extra — only the first note triggers the transition.

## Guardrails preserved

- The existing early-return in `updateMyReviewStatus` for `completed`/`correction` requests is mirrored: skip the auto-promote when `request.status` is `completed` or `correction` (in those states notes are blocked anyway by `prevent_note_edit_when_completed`, but the guard keeps the code defensive).
- Admins who are not reviewers on a request won't have a `review_statuses` row, so the lookup safely no-ops.
- No change to submitter behavior — submitters can't add notes (RLS already enforces `has_role('reviewer')`).

## Verification

1. As a reviewer with `pending` status, add a note on a `pending` request → reviewer badge flips to In Review, request status flips to In Review, audit log gains a `review_status_changed` entry.
2. Add a second note from the same reviewer → no extra status update or audit entry.
3. As a reviewer already `in_review`, adding a note leaves status unchanged.
4. As a reviewer already `completed`, status stays `completed` (note insert itself is blocked once the request is in `correction`/`completed`).