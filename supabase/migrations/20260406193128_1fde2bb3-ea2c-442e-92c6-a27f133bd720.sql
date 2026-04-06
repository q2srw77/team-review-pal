
ALTER TABLE public.review_requests ADD COLUMN archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.cleanup_old_archived_requests()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  DELETE FROM public.review_requests
  WHERE status = 'archived' AND archived_at < now() - interval '6 months';
END; $$;
