## Diagnosis

Latest two submitter-finalized requests both show:
- `report_pdf_path = null` → PDF never generated
- No `review-finalized` row in `email_send_log` → email never enqueued

Meanwhile, `review-all-complete` and `new-review-request` emails are sending fine, so `send-transactional-email` and the queue are healthy.

That isolates the problem to the two **internal** calls inside `finalize-review-request` (to `generate-review-report` and to `send-transactional-email`). Both use raw `fetch(...)` with `Authorization: Bearer ${serviceRoleKey}`. Edge function logs for those invocations are absent, suggesting the requests either fail before reaching the target or are being rejected silently.

## Plan

### 1. Replace `fetch(...)` with `service.functions.invoke(...)` in `finalize-review-request`
File: `supabase/functions/finalize-review-request/index.ts`

The Supabase JS client (already created with the service role key) handles auth headers, retries, and base URL construction reliably. This is the documented pattern.

- Replace the `fetch` call to `generate-review-report` with `service.functions.invoke('generate-review-report', { body: { request_id, skip_email: true } })`. Inspect `error` and `data` to populate `pdfWarning`.
- Replace the `fetch` call to `send-transactional-email` with `service.functions.invoke('send-transactional-email', { body: { ... } })`. Inspect `error` to populate `emailWarning`.
- Keep the existing `pdfWarning` / `emailWarning` response fields so `RequestDetail.tsx` continues to surface failures in the toast.

### 2. Redeploy the affected functions
- `finalize-review-request`
- `generate-review-report` (no code changes, but redeploy to be safe)
- `send-transactional-email` (no code changes, but redeploy to be safe)

### 3. Manually backfill the latest two completed requests
Both completed submissions are missing PDFs. After deploy, call `generate-review-report` directly (with `skip_email: true`) for:
- `f5e5ffc3-092a-4e80-a014-a3145479934f`
- `f498d7e9-7edc-421d-8a4a-9665b1e8dc71`

so historical records have their reports.

### 4. Verify
- Trigger a fresh finalize and confirm:
  - `review_requests.report_pdf_path` is populated
  - `email_send_log` has a `review-finalized` row with `status = sent`
  - Toast shows "Completed" with no warnings

### Out of scope
- No template, schema, or RLS changes.
- `generate-review-report` and `send-transactional-email` source code is not modified.
