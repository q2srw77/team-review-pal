## Goal

Send reviewers an email reminder **1 day before** the `complete_by` date and again **on the due date itself**, so they're prompted to finish before the nightly auto-advance moves the request to Correction.

## Current state

`supabase/functions/send-review-reminders/index.ts` already loops over outstanding reviewers, dedupes via `review_reminders_sent (request_id, reviewer_id, days_before)`, and sends the `review-reminder` template. Today it iterates `[2, 1]`. We just need to change which days it targets and tighten the copy for the due-date case.

## Changes

### 1. `supabase/functions/send-review-reminders/index.ts`
- Change the loop from `[2, 1]` to `[1, 0]`.
- `addDaysUTC(0)` already returns today (UTC), so the existing `complete_by = targetDate` query works for the due-date pass.
- Idempotency still works: `(request_id, reviewer_id, days_before)` with `days_before = 0` is a distinct row from `days_before = 1`, so each reviewer gets at most one "1 day before" and one "due today" email per request.
- Keep the `.neq("status", "completed")` filter so we don't remind on already-completed requests. (Requests already auto-advanced to `correction` won't have outstanding `pending`/`in_review` reviewer rows, so no email is sent — safe.)

### 2. `supabase/functions/_shared/transactional-email-templates/review-reminder.tsx`
The template currently hardcodes "due in N days" wording, which reads awkwardly when `daysRemaining = 0`. Update it to handle the due-date case:
- When `daysRemaining === 0`: subject "Review due today — {title}"; body leads with "Your review is due today" and warns that tonight's auto-advance will move the request to Correction if not finished.
- When `daysRemaining === 1`: subject "Review due tomorrow — {title}"; body says "due tomorrow".
- When `daysRemaining >= 2`: keep current "due in N days" wording (preserves backward compatibility if the array is ever extended).
- Update `previewData.daysRemaining` to `1` so the preview reflects a realistic case.

### 3. Deploy
After the edits, redeploy `send-review-reminders` and `send-transactional-email` (the latter so the updated template ships).

## Out of scope

- No schema changes (`review_reminders_sent` already keys on `days_before`, including 0).
- No change to the cron schedule itself — assumes the existing daily cron job invoking `send-review-reminders` continues to run once per day.
- No change to the auto-close-to-correction flow.
- No new template — we reuse `review-reminder` with conditional copy.

## Verification

1. Manually invoke `send-review-reminders` against a test request with `complete_by = today` → reviewer receives "due today" email; second invocation same day sends nothing (idempotency).
2. Set `complete_by = tomorrow` → reviewer receives "due tomorrow" email.
3. Set `complete_by` 3+ days out → no email sent.
4. Reviewer who already completed their review → no email sent (they're filtered by `.in("status", ["pending", "in_review"])`).
5. Confirm `email_send_log` shows two distinct entries per reviewer per request lifecycle (one for `days_before=1`, one for `days_before=0`).
