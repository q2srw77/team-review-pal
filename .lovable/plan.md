## Goal

Prevent users whose only role is **submitter** from being auto-assigned as reviewers on new review requests. Today, `auto_populate_review_statuses` inserts a `review_statuses` row for every team member (except the submitter), regardless of their role — so a submitter-only teammate ends up on the reviewer list and blocks the request from ever reaching "completed".

## Changes

### 1. Update `auto_populate_review_statuses` trigger function

Filter team members by role. Only insert a `review_statuses` row for users who have `reviewer` or `admin` (admins implicitly have reviewer rights, per project rules).

```sql
INSERT INTO public.review_statuses (request_id, reviewer_id)
SELECT NEW.id, tm.user_id
FROM public.team_members tm
WHERE tm.team_id = NEW.team_id
  AND tm.user_id != NEW.submitted_by
  AND (
    public.has_role(tm.user_id, 'reviewer'::app_role)
    OR public.has_role(tm.user_id, 'admin'::app_role)
  );
```

Everything else about the function (SECURITY DEFINER, `search_path = public`) stays the same.

### 2. Backfill: remove existing stale submitter-only rows

One-off cleanup so currently-open requests stop waiting on submitter-only users:

```sql
DELETE FROM public.review_statuses rs
WHERE NOT public.has_role(rs.reviewer_id, 'reviewer'::app_role)
  AND NOT public.has_role(rs.reviewer_id, 'admin'::app_role);
```

The existing `auto_update_request_status` trigger fires on `review_statuses` changes, so after the delete, any request whose remaining reviewers are all complete will correctly flip to `correction`/`completed`.

### 3. No frontend changes needed

- The reviewer card list in `RequestDetail.tsx` is driven by `review_statuses`, so it updates automatically.
- The admin self-insert path (added previously for first-note auto-promote) already requires `has_role('admin')`, so it's unaffected.
- Manual flows (`updateMyReviewStatus`, note authoring) are gated by `reviewer`/`admin` RLS and remain correct.

## Guardrails

- Submitter-only users are excluded at request creation time and cleaned up retroactively.
- If a user is later granted the `reviewer` role, they are **not** retroactively added to existing requests — only future requests will include them. This matches today's behavior for role changes and avoids surprise assignments. (Call out if you'd like a different policy.)
- Admins are still included (they have implicit reviewer rights).
- The submitter is still excluded from their own request.

## Verification

1. Create a team containing one admin, one reviewer, and one submitter-only user. Have the admin submit a request → only the reviewer (and no row for the submitter-only user) appears in `review_statuses`.
2. Existing open request that was stuck because a submitter-only teammate was "pending" → after migration, that row is gone and the request advances based on the remaining reviewers.
3. Regular reviewer + admin flows (notes, status changes, completion) unchanged.
