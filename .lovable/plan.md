# Fix: "Complete" returns the same edge function error

## Root cause

Edge function log:
```
finalize-review-request error { code: "P0001",
  message: "Reviewers cannot modify these fields on a review request" }
```

The `finalize-review-request` edge function (service role) runs:
```sql
UPDATE review_requests
SET status = 'completed', closed_reason = 'submitter_finalized'
WHERE id = $1;
```

The `BEFORE UPDATE` trigger `guard_review_request_columns` on `review_requests` fires. With service role, `auth.uid()` is `NULL`, so:
- `is_admin` = false (`has_role(NULL, 'admin')` = false)
- `is_submitter` = false (NULL ≠ submitted_by)

It falls through to the "reviewer" branch, sees `closed_reason` changed, and raises the error.

This is the same class of bug as the prior `prevent_note_edit_when_completed` fix: the guard treats unauthenticated/service-role contexts as "reviewer" rather than allowing internal callers.

## Fix

One migration that updates `guard_review_request_columns` to short-circuit and allow the change when `auth.uid() IS NULL` (service role / internal SECURITY DEFINER). The reviewer-edit protections remain unchanged for authenticated reviewer users.

```sql
CREATE OR REPLACE FUNCTION public.guard_review_request_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
  is_submitter boolean;
BEGIN
  -- Service role / internal SECURITY DEFINER callers (auth.uid() is NULL):
  -- allow. The only legitimate paths here are the resubmit-for-review and
  -- finalize-review-request edge functions plus internal triggers.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  is_submitter := (auth.uid() = OLD.submitted_by);

  IF is_admin OR is_submitter THEN
    RETURN NEW;
  END IF;

  -- Reviewer path: block edits to descriptive/ownership fields.
  -- `status` is intentionally excluded — managed by auto_update_request_status()
  -- and submitter-only edge functions.
  IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.platform IS DISTINCT FROM OLD.platform
     OR NEW.url_location IS DISTINCT FROM OLD.url_location
     OR NEW.complete_by IS DISTINCT FROM OLD.complete_by
     OR NEW.closed_reason IS DISTINCT FROM OLD.closed_reason
     OR NEW.report_pdf_path IS DISTINCT FROM OLD.report_pdf_path
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Reviewers cannot modify these fields on a review request';
  END IF;

  RETURN NEW;
END;
$function$;
```

## Out of scope

- No frontend or edge function changes.
- No RLS changes — RLS already restricts which authenticated users can UPDATE `review_requests`.

## Verification

1. As submitter on a request in `correction` with all decisions made, click **Complete** → status becomes `completed`, `closed_reason = 'submitter_finalized'`, PDF generated, finalized email sent.
2. As reviewer, attempt direct REST PATCH to set `closed_reason` or `title` → still rejected.
3. **Re-Submit for Review** still works (already verified after the previous trigger fix).
