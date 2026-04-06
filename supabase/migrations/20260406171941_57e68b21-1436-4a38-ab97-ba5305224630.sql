
-- Create review_statuses table
CREATE TABLE public.review_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.review_requests(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, reviewer_id)
);

ALTER TABLE public.review_statuses ENABLE ROW LEVEL SECURITY;

-- SELECT for all authenticated
CREATE POLICY "Review statuses viewable by authenticated users"
  ON public.review_statuses FOR SELECT TO authenticated
  USING (true);

-- Reviewers can update their own status
CREATE POLICY "Reviewers can update own review status"
  ON public.review_statuses FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id AND has_role(auth.uid(), 'reviewer'::app_role))
  WITH CHECK (auth.uid() = reviewer_id AND has_role(auth.uid(), 'reviewer'::app_role));

-- Service role / triggers can insert
CREATE POLICY "Service role can insert review statuses"
  ON public.review_statuses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Auto-populate trigger: create review_statuses rows for team members when a request is inserted
CREATE OR REPLACE FUNCTION public.auto_populate_review_statuses()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.review_statuses (request_id, reviewer_id)
  SELECT NEW.id, tm.user_id
  FROM public.team_members tm
  WHERE tm.team_id = NEW.team_id
    AND tm.user_id != NEW.submitted_by;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_populate_review_statuses
  AFTER INSERT ON public.review_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_review_statuses();

-- Auto-update trigger: sync review_requests.status based on all reviewer statuses
CREATE OR REPLACE FUNCTION public.auto_update_request_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  total_count int;
  completed_count int;
  in_review_count int;
  new_status text;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'in_review')
  INTO total_count, completed_count, in_review_count
  FROM public.review_statuses
  WHERE request_id = NEW.request_id;

  IF total_count > 0 AND completed_count = total_count THEN
    new_status := 'completed';
  ELSIF in_review_count > 0 OR completed_count > 0 THEN
    new_status := 'in_review';
  ELSE
    new_status := 'pending';
  END IF;

  UPDATE public.review_requests
  SET status = new_status::request_status
  WHERE id = NEW.request_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_update_request_status
  AFTER UPDATE ON public.review_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_request_status();
