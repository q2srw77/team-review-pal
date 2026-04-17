CREATE OR REPLACE FUNCTION public.auto_update_request_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_count int;
  completed_count int;
  in_review_count int;
  new_status text;
  current_status text;
  current_closed_reason text;
BEGIN
  -- Do not overwrite an already-completed request (covers auto-close and natural completion).
  SELECT status::text, closed_reason
  INTO current_status, current_closed_reason
  FROM public.review_requests
  WHERE id = NEW.request_id;

  IF current_status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'in_review')
  INTO total_count, completed_count, in_review_count
  FROM public.review_statuses
  WHERE request_id = NEW.request_id;

  IF total_count > 0 AND completed_count = total_count THEN
    new_status := 'completed';
    UPDATE public.review_requests
    SET status = new_status::request_status,
        closed_reason = COALESCE(closed_reason, 'all_reviewed')
    WHERE id = NEW.request_id;
  ELSE
    IF in_review_count > 0 OR completed_count > 0 THEN
      new_status := 'in_review';
    ELSE
      new_status := 'pending';
    END IF;
    UPDATE public.review_requests
    SET status = new_status::request_status
    WHERE id = NEW.request_id;
  END IF;

  RETURN NEW;
END;
$function$;