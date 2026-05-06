## Context

The PDF report (`supabase/functions/generate-review-report/index.ts`) already includes the position label and number in the reviewer comments (e.g. `Slide 3 — Jane Doe — Nov 5`). Notes are also already sorted by position number. So the data is in the PDF.

What's missing is visual emphasis: in the app the position is shown as a bold white badge on a `#2006F7` background, but in the PDF it's just plain bold text mixed with the author name. The goal is to make the PDF match the UI styling so the Step / Slide / Page label clearly stands out.

## Changes

**File:** `supabase/functions/generate-review-report/index.ts`

In the "Reviewer Comments" loop, replace the single bold header line with a rendered badge + a separate header line:

1. When `positionLabel !== 'None'` and `note.position_number != null`:
   - Draw a filled rounded rectangle at `(margin + 4, y)` using fill color `#2006F7` (RGB `32, 6, 247`).
   - Inside it, draw white bold uppercase text: `${positionLabel} ${note.position_number}` (e.g. `SLIDE 3`).
   - Size the rectangle to fit the text (measure with `doc.getTextWidth`, add ~4pt horizontal padding, ~5pt height).
   - Advance `y` by badge height + small gap.
2. Then draw the author + date line in bold black as today (without the `prefix`):
   - `${authorName} — ${date}`
3. Then the comment body in normal weight, unchanged.

This keeps existing sorting behavior and the "None" case (no badge, no prefix) unchanged.

## Technical notes

- jsPDF API used: `doc.setFillColor(32, 6, 247)`, `doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F')`, `doc.setTextColor(255,255,255)` for badge text, then reset to `doc.setTextColor(0,0,0)` after.
- Reset fill/text color after each badge so subsequent content renders normally.
- Keep the existing `checkPage` call but bump the needed height (e.g. from 16 to 22) to account for the badge row.

## Files Modified
- `supabase/functions/generate-review-report/index.ts`

After the change, the edge function auto-deploys; downloading a report for a request whose platform has a position label will show a colored `SLIDE 3` style badge above each comment.
