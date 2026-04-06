

## Instant Notification When All Reviewers Complete

### Overview
Currently the submitter only receives an email after the PDF report finishes generating (which can take several seconds). This change sends an immediate notification email right when the last reviewer marks "completed", separate from the PDF email that follows later.

### Approach
After a reviewer updates their status in `RequestDetail`, check if all reviewers are now complete. If so, immediately invoke `send-transactional-email` with a new `review-all-complete` template to notify the submitter. The existing PDF generation + `review-completed` email flow remains unchanged.

### New Email Template
Create `supabase/functions/_shared/transactional-email-templates/review-all-complete.tsx` -- a simple notification saying "All reviewers have completed their review for [title]" without a PDF link (since the PDF isn't ready yet). Mention the report will follow shortly.

### Changes

**`supabase/functions/_shared/transactional-email-templates/review-all-complete.tsx`** (new)
- Simple template: heading, request title, platform, team name, message that all reviewers are done and a PDF report will follow

**`supabase/functions/_shared/transactional-email-templates/registry.ts`**
- Register the new `review-all-complete` template

**`src/components/RequestDetail.tsx`**
- In `updateMyReviewStatus`, after the successful status update:
  1. Re-fetch reviewer statuses
  2. Check if all statuses are now "completed"
  3. If yes, fetch the submitter's email from `profiles` and invoke `send-transactional-email` with `templateName: 'review-all-complete'`

### Redeploy
Deploy `send-transactional-email` after template changes.

