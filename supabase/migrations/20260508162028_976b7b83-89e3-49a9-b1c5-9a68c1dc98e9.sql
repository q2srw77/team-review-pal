
-- 1. New columns on request_notes
ALTER TABLE public.request_notes
  ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_comment text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS round_number int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.request_notes
  DROP CONSTRAINT IF EXISTS request_notes_decision_check;
ALTER TABLE public.request_notes
  ADD CONSTRAINT request_notes_decision_check
  CHECK (decision IN ('pending', 'accepted', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_request_notes_request_round
  ON public.request_notes (request_id, round_number, archived);

-- 2. New column on review_requests
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS current_round int NOT NULL DEFAULT 1;

-- 3. Submitter-can-decide RLS policy
DROP POLICY IF EXISTS "Submitter can decide on notes during correction" ON public.request_notes;
CREATE POLICY "Submitter can decide on notes during correction"
ON public.request_notes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_notes.request_id
      AND rr.submitted_by = auth.uid()
      AND rr.status = 'correction'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_notes.request_id
      AND rr.submitted_by = auth.uid()
      AND rr.status = 'correction'
  )
);

-- 4. Tighten reviewer policies on request_notes: only when status pending/in_review
DROP POLICY IF EXISTS "Reviewers can add notes" ON public.request_notes;
CREATE POLICY "Reviewers can add notes"
ON public.request_notes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'reviewer'::app_role)
  AND auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_notes.request_id
      AND rr.status IN ('pending', 'in_review')
  )
);

DROP POLICY IF EXISTS "Authors can update own notes" ON public.request_notes;
CREATE POLICY "Authors can update own notes"
ON public.request_notes
FOR UPDATE TO authenticated
USING (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_notes.request_id
      AND rr.status IN ('pending', 'in_review')
  )
)
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = request_notes.request_id
      AND rr.status IN ('pending', 'in_review')
  )
);

-- 5. Update prevent-edit trigger function to also block on 'correction'
CREATE OR REPLACE FUNCTION public.prevent_note_edit_when_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = NEW.request_id AND rr.status IN ('completed', 'correction')
  ) THEN
    -- Allow submitter to update decision fields during correction; otherwise block.
    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1 FROM public.review_requests rr
      WHERE rr.id = NEW.request_id
        AND rr.status = 'correction'
        AND rr.submitted_by = auth.uid()
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot edit notes on a completed or in-correction request';
  END IF;
  RETURN NEW;
END $$;

-- 6. Replace auto-update status trigger: completion now lands on 'correction'
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
  current_status text;
  new_status text;
BEGIN
  SELECT status::text INTO current_status
  FROM public.review_requests
  WHERE id = NEW.request_id;

  IF current_status IN ('correction', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'in_review')
    INTO total_count, completed_count, in_review_count
  FROM public.review_statuses
  WHERE request_id = NEW.request_id;

  IF total_count > 0 AND completed_count = total_count THEN
    new_status := 'correction';
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
