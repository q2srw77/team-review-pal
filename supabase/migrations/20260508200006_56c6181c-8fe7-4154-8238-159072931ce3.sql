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
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  is_submitter := (auth.uid() = OLD.submitted_by);

  IF is_admin OR is_submitter THEN
    RETURN NEW;
  END IF;

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