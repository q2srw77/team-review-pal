CREATE TABLE public.review_reminders_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.review_requests(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  days_before integer NOT NULL CHECK (days_before IN (1, 2)),
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (request_id, reviewer_id, days_before)
);

CREATE INDEX idx_review_reminders_sent_request ON public.review_reminders_sent(request_id);

ALTER TABLE public.review_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage review reminders"
  ON public.review_reminders_sent
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');