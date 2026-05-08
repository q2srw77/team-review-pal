# Fix: "Reviewers cannot modify these fields on a review request"

## Root cause

When a reviewer changes their own status in `review_statuses` (Pending → In Review / Completed), the `auto_update_request_status` trigger fires and runs an `UPDATE public.review_requests SET status = ...`. Even though that trigger is `SECURITY DEFINER`, the `BEFORE UPDATE` trigger `guard_review_request_columns` on `review_requests` still evaluates `auth.uid()` — which is the reviewer.

The guard treats the reviewer as "not admin, not submitter" and explicitly forbids any change to `status`, so the cascading status update is rejected and the original `review_statuses` update bubbles up the error shown in the screenshot:

> Reviewers cannot modify these fields on a review request

This is a regression introduced when the Correction-stage migration broadened `auto_update_request_status` to set `status = 'correction'` on completion (any branch that actually changes `review_requests.status` triggers the guard).

## Fix

Update `public.guard_review_request_columns()` so that legitimate status transitions driven by the auto-update trigger are not blocked, while still preventing reviewers from directly editing other fields (title, team_id, complete_by, notes, report path, etc.).

Approach: drop `status` from the forbidden-change list in the reviewer branch. Status is already protected by:

- The `auto_update_request_status` trigger, which is the only legitimate path for reviewers to influence it (computed from `review_statuses`).
- RLS on `review_requests` UPDATE for reviewers (must be assigned via `review_statuses`).
- The submitter-only edge functions `resubmit-for-review` and `finalize-review-request` (service role) for `correction` → `pending` and `correction` → `completed` transitions.

A reviewer cannot directly issue `UPDATE review_requests SET status = ...` to a meaningful value because the auto-update trigger only runs on `review_statuses` changes; any direct write the reviewer attempts will simply be overwritten on the next status recompute, and no path exists in the UI for them to do so.

## Migration (single statement)

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
  is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  is_submitter := (auth.uid() = OLD.submitted_by);

  IF is_admin OR is_submitter THEN
    RETURN NEW;
  END IF;

  -- Reviewer path: block edits to descriptive/ownership fields.
  -- `status` is intentionally excluded — it is managed by
  -- auto_update_request_status() and submitter-only edge functions.
  IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.team_id     IS DISTINCT FROM OLD.team_id
     OR NEW.title       IS DISTINCT FROM OLD.title
     OR NEW.platform    IS DISTINCT FROM OLD.platform
     OR NEW.url_location IS DISTINCT FROM OLD.url_location
     OR NEW.complete_by  IS DISTINCT FROM OLD.complete_by
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

- No frontend changes.
- No changes to `auto_update_request_status`, RLS, or edge functions.

## Verification

- As a reviewer, change status Pending → In Review → Completed on the screenshot's request. No error; `review_requests.status` advances pending → in_review → correction once all reviewers complete.
- As a reviewer, attempt to PATCH `review_requests` directly with a new title / team_id / status via REST — title/team_id still rejected; status no longer rejected by guard but RLS + lack of UI path keep behavior unchanged.
- Submitter Re-Submit and Complete actions in the Correction stage still work (they run as service role and bypass the guard entirely).
