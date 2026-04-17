

## Pre-Deadline Reminder Emails (T-2 and T-1 days)

### Goal
Email outstanding reviewers (those whose `review_statuses.status` is still `pending` or `in_review`) 2 days and 1 day before a request's `complete_by` date, so they have a chance to finish before auto-close fires.

### Approach
Reuse the existing hourly cron infrastructure already powering auto-close. Add a new edge function that runs daily and sends reminders, plus a small tracking table to guarantee each reviewer gets at most one reminder per (request, day-offset).

### Changes

**1. New table: `review_reminders_sent`** (migration)
- Columns: `id`, `request_id`, `reviewer_id`, `days_before` (int: 2 or 1), `sent_at`
- Unique constraint on `(request_id, reviewer_id, days_before)` — guarantees idempotency even if the cron runs twice.
- Service-role-only RLS (only the edge function writes/reads it).

**2. New email template: `review-reminder.tsx`**
- Props: `title`, `platform`, `teamName`, `daysRemaining` (2 or 1), `completeBy`, `submitterName`
- Subject: `Reminder: review due in {daysRemaining} day(s) — {title}`
- Friendly nudge: "Your review for X is due in N day(s). After the deadline it will be auto-closed."
- Register in `_shared/transactional-email-templates/registry.ts`.

**3. New edge function: `supabase/functions/send-review-reminders/index.ts`**
- Service-role; CORS preflight; verify_jwt = false in config.toml.
- For each `daysBefore in [2, 1]`:
  - Compute `targetDate = today + daysBefore days` (UTC).
  - Query `review_requests` where `status != 'completed'` AND `complete_by = targetDate`.
  - For each request, fetch `review_statuses` rows where `status IN ('pending','in_review')`, join reviewer profile (email, full_name).
  - For each outstanding reviewer:
    - Insert into `review_reminders_sent` with `onConflict: do nothing`. If 0 rows inserted, skip (already sent).
    - Otherwise invoke `send-transactional-email` with template `review-reminder`, idempotency key `reminder-${request.id}-${reviewer.id}-${daysBefore}`.
- Return JSON summary.

**4. pg_cron schedule** (insert tool, not migration — contains URL/key)
- Daily at 14:00 UTC (~9 AM ET / midmorning EU). Calls `send-review-reminders` via `net.http_post` with the service-role bearer token, mirroring the existing auto-close cron pattern.

**5. `supabase/config.toml`**
- Add `[functions.send-review-reminders]` block with `verify_jwt = false`.

### Files
- **New**: `supabase/functions/send-review-reminders/index.ts`
- **New**: `supabase/functions/_shared/transactional-email-templates/review-reminder.tsx`
- **New migration**: `review_reminders_sent` table + RLS
- **New cron**: scheduled via insert tool
- **Modify**: `supabase/functions/_shared/transactional-email-templates/registry.ts`
- **Modify**: `supabase/config.toml`

### Notes
- Date comparison uses `complete_by` (a `date` column) so timezone drift across midnight is bounded to one day max — acceptable for a "reminder" use case.
- Reviewers who already completed are excluded by status filter — they won't be nagged.
- Submitter is not reminded (they can't accelerate other people's reviews).
- The unique constraint is the safety net: even with overlapping cron runs, manual invocations, or retries, no reviewer gets duplicate reminders.

