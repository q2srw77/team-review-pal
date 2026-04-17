

## Review: Gaps in Review Hub Auto-Close + Completion Notification Flow

### What works today
- Submitters create requests with a `complete_by` date (RequestForm.tsx).
- Reviewers update individual statuses; `auto_update_request_status` trigger flips request to `completed` only when ALL reviewers complete.
- On final completion, RequestDetail triggers `review-all-complete` email + `generate-review-report` PDF.
- Overdue requests show a red warning icon on the dashboard.

### Gaps Found

**1. No auto-close on `complete_by` date (the core gap in your request)**
Today, a request only reaches `completed` when every reviewer manually marks "completed". If the deadline passes with pending reviewers, the request stays `pending`/`in_review` forever — the submitter never gets the "review is ready" email.

**2. No scheduled job watching deadlines**
There is no pg_cron job or edge function that scans for overdue requests. The existing daily cron (per memory) is for digest reports, not auto-closing.

**3. Submitter completion email only fires on full reviewer consensus**
The `review-all-complete` email is invoked from the client (`RequestDetail.updateMyReviewStatus`) at the moment the last reviewer completes. If auto-close happens server-side via cron, that client path won't run — we need server-side email dispatch too.

**4. No indicator that a request was auto-closed vs. fully reviewed**
Submitter can't distinguish "all reviewers finished" from "deadline hit, partial reviews". The completion email/report should reflect this.

### Proposed Solution

**A. New edge function: `auto-close-overdue-requests`**
- Runs on a schedule (pg_cron, every hour or daily at a chosen time).
- Selects `review_requests` where `status != 'completed'` AND `complete_by < CURRENT_DATE`.
- For each overdue request:
  - Marks remaining `pending`/`in_review` reviewer statuses as `auto_closed` (new status value) OR leaves them and just flips request status.
  - Updates `review_requests.status` to `completed` (using service role, bypasses RLS).
  - Invokes `send-transactional-email` with `review-all-complete` template to the submitter (idempotency key: `auto-close-${requestId}`).
  - Invokes `generate-review-report` to produce the PDF.
  - Writes an audit log entry (`action: 'auto_closed'`).

**B. Schema addition (minimal)**
- Add nullable `closed_reason text` column to `review_requests` (`'all_reviewed'` | `'deadline_reached'`) so the UI and email can distinguish them.
- Optional: add `'auto_closed'` to allowed `review_statuses.status` values so partial reviews aren't misrepresented as `completed`.

**C. Email template tweak**
- Update `review-all-complete.tsx` to optionally show a "Closed due to deadline (X of Y reviewers completed)" note when `closedReason === 'deadline_reached'`.

**D. Dashboard UI**
- Show a small "Auto-closed" badge on completed requests where `closed_reason = 'deadline_reached'` so submitters understand context.

**E. pg_cron schedule**
- Insert a cron job (hourly) calling the new edge function via `net.http_post` with the service-role-authenticated URL pattern already used elsewhere.

### Files to Create / Modify

- **New**: `supabase/functions/auto-close-overdue-requests/index.ts`
- **New migration**: add `closed_reason` column + cron job SQL (cron via insert tool, since it contains URL/keys)
- **Modify**: `supabase/functions/_shared/transactional-email-templates/review-all-complete.tsx` (optional deadline note)
- **Modify**: `src/components/RequestDetail.tsx` (display closed_reason badge/note)
- **Modify**: `src/pages/Dashboard.tsx` (small badge for auto-closed requests)
- **Modify**: `supabase/config.toml` if function-specific config needed

### Open Question

Before I implement, one decision point:

When the deadline passes with some reviewers still pending, should we:
- **(A) Force-close**: mark request `completed`, leave incomplete reviewer rows as `pending`, send submitter the report with whatever notes exist.
- **(B) Soft-close**: keep request open but send the submitter a "deadline reached, partial review available" email and lock further edits.

I recommend **(A) Force-close** since your request says "the review should close" and "submitter gets automated update that review is ready" — that maps cleanly to status=`completed` + report email.

