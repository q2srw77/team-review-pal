## Allow Reviewers to Edit Their Own Notes

### Goal
A reviewer can edit the content (and position number, when applicable) of notes they themselves authored. No one — not other reviewers, not submitters, not even admins — can edit someone else's note. Editing is blocked once the request is `completed` (consistent with the existing lock behavior for status changes).

### Database (migration)

Add an RLS UPDATE policy on `public.request_notes`:

```sql
CREATE POLICY "Authors can update own notes"
ON public.request_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);
```

No schema change — `position_number` already exists. The policy intentionally does **not** include admins; only the author may edit.

(Optional hardening: a `BEFORE UPDATE` trigger that blocks updates when the parent `review_requests.status = 'completed'`. Including this so the lock is enforced server-side, not just in the UI.)

```sql
CREATE OR REPLACE FUNCTION public.prevent_note_edit_when_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.review_requests rr
             WHERE rr.id = NEW.request_id AND rr.status = 'completed') THEN
    RAISE EXCEPTION 'Cannot edit notes on a completed request';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER request_notes_block_edit_when_completed
BEFORE UPDATE ON public.request_notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_note_edit_when_completed();
```

### Frontend — `src/components/RequestDetail.tsx`

1. Track the current user id on each note item: include `author_id` in the `Note` interface and `fetchNotes` mapping.
2. Add edit-mode state per note: `editingNoteId`, `editNoteContent`, `editNotePosition`.
3. In the rendered note card, when `note.author_id === user.id` and `request.status !== "completed"`, show a small "Edit" pencil button next to the timestamp.
4. Edit mode swaps the note body for a `Textarea` (and a numeric `Input` for position when `positionLabel !== "None"`), with Save / Cancel buttons.
5. Save handler:
   ```ts
   await supabase
     .from("request_notes")
     .update({ content: trimmed, position_number: positionNumber })
     .eq("id", note.id);
   ```
   Re-validate the position number with the same 1–999 rule as `addNote`. On success, clear edit state and call `fetchNotes()`.
6. No changes to PDF generation — it already reads the latest `content` and `position_number`.

### Out of Scope
- Edit history / audit trail of note edits.
- Admin override editing.
- Editing notes after a request is completed.

### Files Modified
- New migration file under `supabase/migrations/`
- `src/components/RequestDetail.tsx`
