-- Add 'archived' to request_status enum
ALTER TYPE public.request_status ADD VALUE 'archived';

-- DELETE policies on review_requests
CREATE POLICY "Submitters can delete own requests"
ON public.review_requests FOR DELETE TO authenticated
USING (auth.uid() = submitted_by);

CREATE POLICY "Admins can delete requests"
ON public.review_requests FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- DELETE policies on review_statuses and request_notes for cascade cleanup
CREATE POLICY "Authenticated can delete own request review statuses"
ON public.review_statuses FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_id
    AND (rr.submitted_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Authenticated can delete own request notes"
ON public.request_notes FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_id
    AND (rr.submitted_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);