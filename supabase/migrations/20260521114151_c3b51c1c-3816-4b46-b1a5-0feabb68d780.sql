DROP POLICY IF EXISTS "Reviewers can update own review status" ON public.review_statuses;

CREATE POLICY "Reviewers or admins can update own review status"
ON public.review_statuses
FOR UPDATE
TO authenticated
USING (
  auth.uid() = reviewer_id
  AND (public.has_role(auth.uid(), 'reviewer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  auth.uid() = reviewer_id
  AND (public.has_role(auth.uid(), 'reviewer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can self-insert review status"
ON public.review_statuses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND public.has_role(auth.uid(), 'admin'::app_role)
  AND NOT EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = review_statuses.request_id
      AND rr.submitted_by = auth.uid()
  )
);