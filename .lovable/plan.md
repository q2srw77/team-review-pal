## Position Labels for Platforms + Numbered Reviewer Notes

### Goal
Let admins tag each platform with a position label (`Slide`, `Step`, `Page`, or `None`). When reviewers add a note on a request whose platform has a non-`None` label, they must enter a 1–3 digit number alongside the comment. Notes are then displayed (and exported) ordered by that number rather than by timestamp.

### Database
New column on `platforms`:
- `position_label text not null default 'None'` with a CHECK constraint limiting values to `'None' | 'Slide' | 'Step' | 'Page'`.

New column on `request_notes`:
- `position_number int null` — stores the slide/step/page number (1–999). Null for notes on `None`-labeled platforms or legacy notes.

No data migration needed; existing rows default to `None` / `null`.

### Backend / Edge Functions
`supabase/functions/generate-review-report/index.ts`:
- Select `position_number` along with note fields.
- When the request's platform has a non-`None` `position_label`, sort notes by `position_number ASC NULLS LAST, created_at ASC` and prefix each note's printed body with `"<Label> <n>: "`. Otherwise keep current `created_at ASC` ordering.

(Auto-generated `types.ts` will update automatically after the migration — no manual edit.)

### Frontend

**`src/components/settings/PlatformManagement.tsx`**
- Show a `Position Label` column in the table.
- Add a `Select` (Slide / Step / Page / None) to the Add and Edit dialogs; default `None`.
- Persist `position_label` on insert/update.

**`src/components/RequestDetail.tsx`**
- Fetch the current request's platform row to know its `position_label` (single query in `useEffect`).
- Reviewer "Add note" UI: when label ≠ `None`, render a small numeric `Input` (`inputMode="numeric"`, `maxLength={3}`, regex-stripped to digits, range 1–999) next to the textarea, with the label as a prefix (e.g. `Slide [ 12 ]`). Number is required to submit when label ≠ `None`.
- On submit, insert `position_number` along with `content` (store the raw user note in `content`, the number in `position_number` — no string parsing).
- When fetching notes, also select `position_number`. If platform label ≠ `None`, sort notes client-side by `position_number` (nulls last), then `created_at`, and render each note's header with a chip like `Slide 12` before the author/date row.
- Legacy notes (null `position_number`) appear at the bottom of the ordered list.

**`src/components/RequestForm.tsx`** — no change. The number is captured per-note, not on the request itself.

### UX details
- Numeric input rejects non-digits via `onChange` filter (`value.replace(/\D/g, "").slice(0, 3)`).
- Empty / `0` is invalid; show an inline message and disable the Add Note button.
- The label text shown to reviewers comes from the platform row, so changing a platform's label later affects only future notes' display ordering — stored numbers remain valid.
- For platforms with label `None`, the form behaves exactly as today.

### Files Modified
- `supabase/migrations/<new>.sql` (add columns + check constraint)
- `src/components/settings/PlatformManagement.tsx`
- `src/components/RequestDetail.tsx`
- `supabase/functions/generate-review-report/index.ts`

### Out of Scope
- Editing `position_number` after a note is created.
- Backfilling existing notes with parsed numbers from their content.
- Changing email templates (reminder / all-complete) — they don't list note bodies.
