-- Drop the overly-permissive policy
DROP POLICY IF EXISTS "Reviewers can update requests" ON public.review_requests;

-- Replace with assignment-scoped policy with both USING and WITH CHECK
CREATE POLICY "Reviewers can update assigned requests"
ON public.review_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'reviewer'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.review_statuses rs
    WHERE rs.request_id = review_requests.id
      AND rs.reviewer_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'reviewer'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.review_statuses rs
    WHERE rs.request_id = review_requests.id
      AND rs.reviewer_id = auth.uid()
  )
);