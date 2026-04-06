

## Review Completion PDF Report & Email Notification

### Overview
When all reviewers complete their reviews (or the complete-by date passes), generate a PDF summary of the review request with all reviewer comments, email it to the submitter, and make it downloadable from the request detail view.

### Architecture

There are two triggers for sending the completion email with PDF:
1. **All reviewers completed** -- detected by the existing `auto_update_request_status` trigger when status becomes "completed"
2. **Complete-by date passed** -- a scheduled database cron job that checks daily for overdue requests

The PDF must be generated server-side (Edge Function) since it needs to be attached to an email (via download link, since attachments aren't supported) and stored for later download.

### Database Changes

**Migration: Add `report_pdf_path` column to `review_requests`**
- `report_pdf_path` (text, nullable) -- stores the storage path to the generated PDF

**Migration: Create a `review-reports` storage bucket**
- Public bucket so authenticated users can download PDFs via URL

**Migration: Update `auto_update_request_status` trigger**
- After setting status to "completed", call an Edge Function to generate the PDF and email the submitter

### Edge Function: `generate-review-report`

A new Edge Function that:
1. Accepts a `request_id`
2. Fetches the review request details, team name, submitter info, reviewer statuses with names, and all reviewer notes
3. Generates a PDF using a Deno-compatible PDF library (e.g., `jspdf`)
4. Uploads the PDF to the `review-reports` storage bucket
5. Updates `review_requests.report_pdf_path` with the storage path
6. Sends a transactional email to the submitter via `send-transactional-email` with a link to download the PDF

### Trigger Mechanisms

**Trigger 1: All reviewers completed**
- Modify `auto_update_request_status()` database function: after setting status to "completed", use `pg_net` to call the `generate-review-report` Edge Function

**Trigger 2: Complete-by date passed**
- Add a pg_cron job that runs daily, finds requests where `complete_by < CURRENT_DATE` and `status != 'completed'` and `report_pdf_path IS NULL`
- For each, call the `generate-review-report` Edge Function

### Email Template: `review-completed`

A new transactional email template notifying the submitter that their review is ready, with a button/link to download the PDF report.

### UI Changes

**`src/components/RequestDetail.tsx`**
- If `request.report_pdf_path` is set, show a "Download Report" button that links to the PDF in storage

**`src/pages/Dashboard.tsx`**
- Add a small download icon/button in the table row when `report_pdf_path` is present

### Files to create/modify

| File | Change |
|------|--------|
| New migration | Add `report_pdf_path` column, create storage bucket, update trigger |
| `supabase/functions/generate-review-report/index.ts` | New Edge Function: generate PDF, upload to storage, trigger email |
| `supabase/functions/_shared/transactional-email-templates/review-completed.tsx` | New email template for review completion |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Register new template |
| `src/components/RequestDetail.tsx` | Add "Download Report" button |
| `src/pages/Dashboard.tsx` | Add download icon in table rows |
| `supabase/config.toml` | Add `generate-review-report` function config |

### Technical Details

- PDF generation in Deno Edge Function using `jsPDF` (`npm:jspdf`)
- Storage bucket with RLS: authenticated users can read; service role can insert
- The trigger function uses `pg_net` (or `net.http_post`) to asynchronously invoke the Edge Function, avoiding blocking the database transaction
- The cron job for overdue requests prevents the case where not all reviewers respond but the deadline passes

