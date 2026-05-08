# Fix: "Re-submit for Review" returns Edge Function 2xx error

## Root cause

Edge function log:
```
resubmit-for-review error { code: "P0001", message: "Cannot edit notes on a completed or in-correction request" }
```

The `resubmit-for-review` edge function (service role) runs:
```sql
UPDATE request_notes SET archived = true
 WHERE request_id = $1 AND round_number = $current;
```

The `BEFORE UPDATE` trigger `prevent_note_edit_when_completed` on `request_notes` fires and:
1. Sees the parent request is in `correction` → enters the guard.
2. Tries to allow only when `auth.uid() = rr.submitted_by`.
3. Service role calls have `auth.uid() = NULL`, so the allow branch fails and it raises the error.

The submitter's per-note Accept/Reject decisions work (they go through the user's JWT, so `auth.uid()` matches `submitted_by`). Only the service-role archival path is broken — exactly the resubmit flow.

## Fix

One migration that updates the trigger function so legitimate service-role / `SECURITY DEFINER` paths are allowed, while still blocking direct user edits to notes once a request is `completed` or in `correction`.

```sql
CREATE OR REPLACE FUNCTION public.prevent_note_edit_when_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role / internal SECURITY DEFINER callers (auth.uid() is NULL):
  -- allow. These paths are the resubmit-for-review and finalize-review-request
  -- edge functions, which are the only legitimate writers in those states.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = NEW.request_id AND rr.status IN ('completed', 'correction')
  ) THEN
    -- Allow submitter to update decision fields during correction.
    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1 FROM public.review_requests rr
      WHERE rr.id = NEW.request_id
        AND rr.status = 'correction'
        AND rr.submitted_by = auth.uid()
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot edit notes on a completed or in-correction request';
  END IF;
  RETURN NEW;
END $function$;
```

## Out of scope

- No frontend changes.
- No edge function changes (the existing service-role archival logic is correct once the trigger lets it through).
- No RLS changes — RLS already prevents non-service-role users from touching notes outside their permissions.

## Verification

1. As submitter, on a request in `correction`, click **Re-Submit for Review** → succeeds, `current_round` increments, prior notes are flagged `archived = true`, reviewers' statuses reset to `pending`, and `review-resubmitted` emails enqueue.
2. As reviewer, attempt to edit a note on a completed/correction request directly via REST → still blocked.
3. As submitter, Accept/Reject per-note decisions during correction → still works.
4. Finalize flow (service role) on a correction request → still works.
