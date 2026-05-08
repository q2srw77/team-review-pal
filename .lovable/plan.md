## Diagnosis

For the most recent completed request (`f498d7e9…` finalized at 20:02 UTC):
- `report_pdf_path` is **null** → PDF generation never succeeded.
- `email_send_log` has **no `review-finalized` row** → the email to the submitter was never enqueued.

The audit log confirms `finalize-review-request` did run successfully, so the failures happened in the two side-effect calls it makes:

1. `fetch(.../generate-review-report …)` — failed silently (caught by `try/catch`, only `console.error`'d). PDF was not produced.
2. `fetch(.../send-transactional-email …)` for `review-finalized` — also failed silently.

The most likely root cause for #2 is that `send-transactional-email` (and `generate-review-report`) were not redeployed after the `review-finalized` template / recent code changes were added, so the registry / latest code is not live. Edge Function logs are unavailable for the time window, so a redeploy + retry is the fastest verification path.

A secondary hardening issue: `finalize-review-request` swallows all errors from the two downstream calls. If anything goes wrong, the submitter sees "Completed" toast but never gets the email and there's no surfaced error.

## Plan

### 1. Redeploy the relevant Edge Functions
Redeploy so the latest registry (`review-finalized`) and code are live:
- `send-transactional-email`
- `generate-review-report`
- `finalize-review-request`

### 2. Harden `finalize-review-request`
File: `supabase/functions/finalize-review-request/index.ts`
- Check the HTTP response status of both internal `fetch` calls (currently only catches network errors, not non-2xx) and log the response body on failure.
- Always attempt to send the `review-finalized` email even if PDF generation failed (already the case, but ensure `downloadUrl` empty-string is gracefully handled by the template — it already is).
- Return a non-fatal warning in the JSON response when the PDF or email step failed, so the client can surface a toast like "Completed, but email/PDF failed — please contact support" instead of the optimistic "report has been emailed to you".

### 3. Frontend toast accuracy
File: `src/components/RequestDetail.tsx` (around line 238)
- Read the new warnings field from the `finalize-review-request` response. If PDF or email failed, show a warning toast instead of the success message.

### 4. Verify
- After redeploy, finalize a fresh test request and confirm:
  - `report_pdf_path` is populated on `review_requests`
  - `email_send_log` has a `review-finalized` row with `status = sent`

### Out of scope
- No template changes (the template is correct and registered).
- No DB schema changes.
- The `review-all-complete` email (sent when all reviewers finish) is already working — not touched.