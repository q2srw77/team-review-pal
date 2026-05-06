
-- 1. Tighten request_notes DELETE policy: author or admin only
DROP POLICY IF EXISTS "Authenticated can delete own request notes" ON public.request_notes;

CREATE POLICY "Authors or admins can delete notes"
ON public.request_notes
FOR DELETE
TO authenticated
USING (
  auth.uid() = author_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Trigger to prevent reviewers from rewriting sensitive columns on review_requests
CREATE OR REPLACE FUNCTION public.guard_review_request_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  is_submitter boolean;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  is_submitter := (auth.uid() = OLD.submitted_by);

  IF is_admin OR is_submitter THEN
    RETURN NEW;
  END IF;

  -- Caller is a reviewer (per RLS); only allow narrow fields to change.
  IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.platform IS DISTINCT FROM OLD.platform
     OR NEW.url_location IS DISTINCT FROM OLD.url_location
     OR NEW.complete_by IS DISTINCT FROM OLD.complete_by
     OR NEW.closed_reason IS DISTINCT FROM OLD.closed_reason
     OR NEW.report_pdf_path IS DISTINCT FROM OLD.report_pdf_path
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Reviewers cannot modify these fields on a review request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_review_request_columns_trg ON public.review_requests;
CREATE TRIGGER guard_review_request_columns_trg
BEFORE UPDATE ON public.review_requests
FOR EACH ROW
EXECUTE FUNCTION public.guard_review_request_columns();
