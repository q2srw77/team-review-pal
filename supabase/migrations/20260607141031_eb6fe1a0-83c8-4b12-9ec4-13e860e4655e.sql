CREATE OR REPLACE FUNCTION public.auto_populate_review_statuses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.review_statuses (request_id, reviewer_id)
  SELECT NEW.id, tm.user_id
  FROM public.team_members tm
  WHERE tm.team_id = NEW.team_id
    AND tm.user_id != NEW.submitted_by
    AND (
      public.has_role(tm.user_id, 'reviewer'::app_role)
      OR public.has_role(tm.user_id, 'admin'::app_role)
    );
  RETURN NEW;
END;
$function$;

DELETE FROM public.review_statuses rs
WHERE NOT public.has_role(rs.reviewer_id, 'reviewer'::app_role)
  AND NOT public.has_role(rs.reviewer_id, 'admin'::app_role);