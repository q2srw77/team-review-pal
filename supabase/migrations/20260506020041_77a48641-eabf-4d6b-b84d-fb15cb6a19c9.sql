CREATE POLICY "Authors can update own notes"
ON public.request_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.prevent_note_edit_when_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.review_requests rr
    WHERE rr.id = NEW.request_id AND rr.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Cannot edit notes on a completed request';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER request_notes_block_edit_when_completed
BEFORE UPDATE ON public.request_notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_note_edit_when_completed();