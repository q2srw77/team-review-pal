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