ALTER TABLE public.review_requests
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN complete_by date;