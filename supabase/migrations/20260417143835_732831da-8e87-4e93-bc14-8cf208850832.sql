ALTER TABLE public.review_requests
ADD COLUMN closed_reason text;

COMMENT ON COLUMN public.review_requests.closed_reason IS 'Reason the request was marked completed: all_reviewed or deadline_reached';