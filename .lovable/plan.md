

## Fix: Reviewer Cannot Change Review Status

### Root Cause
The review request "MDR Overview" (submitted by Steve Weber) has **no rows in the `review_statuses` table**. This request was created before the `auto_populate_review_statuses` trigger was added to the database, so reviewer status rows were never generated.

Steve Cypher (the only non-submitter team member) should have a `review_statuses` row but doesn't, which means there's nothing to display or update in the Reviewer Progress section.

### Fix

**Database migration** to backfill missing `review_statuses` for existing requests that have a `team_id` but no corresponding reviewer rows:

```sql
INSERT INTO public.review_statuses (request_id, reviewer_id)
SELECT rr.id, tm.user_id
FROM public.review_requests rr
JOIN public.team_members tm ON tm.team_id = rr.team_id
WHERE tm.user_id != rr.submitted_by
  AND rr.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.review_statuses rs
    WHERE rs.request_id = rr.id AND rs.reviewer_id = tm.user_id
  );
```

This is a one-time data fix. No code changes needed -- the trigger already handles new requests correctly, and the UI already supports updating reviewer status.

### Files changed
| File | Change |
|------|--------|
| New migration | Backfill missing `review_statuses` rows |

