## Goal

When an **admin** posts the first comment on a request, their reviewer card should flip from Pending → In Review automatically, exactly like a regular reviewer. Today this silently no-ops for admins in two cases:

1. The admin has no row in `review_statuses` for the request (admins aren't added by the `auto_populate_review_statuses` trigger, which only inserts `team_members`).
2. Even if a row exists, the `review_statuses` UPDATE RLS policy requires `has_role('reviewer')`. Admins without the reviewer role are blocked, and we don't surface the error.

## Changes

### 1. RLS — allow admins to manage their own review status

Migration on `public.review_statuses`:

- **UPDATE policy** — replace `Reviewers can update own review status` with one that accepts either role:
  ```
  (auth.uid() = reviewer_id) AND (has_role(auth.uid(),'reviewer') OR has_role(auth.uid(),'admin'))
  ```
- **INSERT policy** — add `Admins can self-insert review status`:
  ```
  WITH CHECK: auth.uid() = reviewer_id
              AND has_role(auth.uid(),'admin')
              AND NOT EXISTS (SELECT 1 FROM review_requests rr
                              WHERE rr.id = request_id AND rr.submitted_by = auth.uid())
  ```
  (Submitter-exclusion rule preserved — admins can't review their own requests.)
- **DELETE policy** — unchanged; admins already covered by the existing policy.

### 2. Frontend — `addNote` in `src/components/RequestDetail.tsx`

Around line 483, after a successful note insert:

- If the current user **has** a `review_statuses` row and its status is `pending` → UPDATE to `in_review` (current behavior, unchanged).
- If the current user has **no** row and is an admin and is **not** the submitter and request status is `pending`/`in_review` → INSERT a new row with `status = 'in_review'`, `reviewer_id = user.id`.
- Either path: fire the existing `write-audit-log` call with `auto: "first_note"`, then `fetchReviewerStatuses()` + `onUpdated()`.
- Surface a toast on RLS error (currently swallowed) so future mismatches are visible.

The `auto_update_request_status` trigger then promotes the request itself, so no extra request-level write is needed.

## Guardrails

- Submitters still can't self-review (enforced in both new INSERT RLS and the frontend guard).
- `completed` / `correction` requests still skip the promote (already-locked notes path).
- Regular reviewer behavior is unchanged — the UPDATE policy just broadens to also accept admins.

## Verification

1. As an **admin who has no `review_statuses` row** on a `pending` request, post the first note → a new `in_review` row appears for that admin, the request flips to In Review, and an audit log entry is written.
2. As an **admin who already has a `pending` row** (admin is also a team member), post the first note → row updates to `in_review`; no duplicate insert.
3. As a regular **reviewer**, behavior is identical to today.
4. As a **submitter** (admin or not), no row is inserted and no auto-promote happens.
5. Manual status changes via the badge dropdown still work for admins.
