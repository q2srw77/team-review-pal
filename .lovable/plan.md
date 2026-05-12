## Goal

Let the submitter resubmit a request for review **as many times as needed**, and require them to set a **new `complete_by` deadline** each time. The new deadline drives the next round's auto-advance and reminders.

## Findings

- **There is no hard limit** on resubmits in the code: `supabase/functions/resubmit-for-review/index.ts` simply increments `current_round`, archives the round's notes, and resets reviewer statuses. The UI's "Re-Submit for Review" button has no round-count gating either.
- What *feels* like a "single send back" today:
  1. `review_requests.complete_by` is **not updated** on resubmit, so round 2 inherits the original (often already-passed) deadline. The auto-close cron then immediately punts the request back to Correction.
  2. `review_reminders_sent` is keyed `(request_id, reviewer_id, days_before)` with no round component, so reminders for round 2+ are deduped against round 1 and never fire.
- Reviewer-progress visuals already work with `current_round`, and `request_notes` are scoped by `round_number`, so multiple rounds are already rendered correctly.

## Changes

### 1. UI — `src/components/RequestDetail.tsx`
- Replace the simple Re-Submit confirm dialog with a small form requiring a **new Complete By date**:
  - Reuse the existing `Calendar` / `Popover` pattern from edit mode.
  - Default the picker to `today + 7` days; minimum selectable date is **tomorrow** (deadline must be in the future).
  - The "Re-Submit" action is disabled until a valid future date is picked.
  - Copy update: "Set a new complete-by deadline. Reviewers will be notified to start round N+1."
- Pass the chosen date to the edge function as `new_complete_by` (ISO `YYYY-MM-DD`).
- After success, refresh as today (`onUpdated()` already reloads).

### 2. Edge function — `supabase/functions/resubmit-for-review/index.ts`
- Accept and validate `new_complete_by` in the request body:
  - Required, must parse as a date, must be **strictly after today** (UTC). Reject 400 otherwise.
- Include `complete_by: new_complete_by` in the `review_requests` update alongside `current_round` and `status: 'pending'`.
- Also clear `closed_reason` (it may be `'deadline_reached'` from a prior auto-advance) so the new round starts clean.
- After bumping the round, **delete prior `review_reminders_sent` rows for this request** so the 1-day-before / due-day reminders fire again against the new deadline. (Service role already has full access to that table.)
- Add `new_complete_by` to the audit log `details`.
- Forward the new deadline to the `review-resubmitted` email template via `templateData.completeBy` so reviewers see the new date in their inbox.

### 3. Email template — `supabase/functions/_shared/transactional-email-templates/review-resubmitted.tsx`
- Add an optional `completeBy` prop and render it in the details block ("Complete by: …") so reviewers immediately see the updated deadline. Keep the prop optional for backward-compat.

### 4. Deploy
After edits, redeploy `resubmit-for-review` and `send-transactional-email`.

## Out of scope

- No schema changes. `review_requests.complete_by` is already nullable date; `review_reminders_sent` already has the right shape (we simply purge rows for the request).
- No round cap. The system stays unlimited; each round just requires a new deadline.
- No change to `auto-close-overdue-requests` — once `complete_by` is updated, the existing logic naturally handles the new round and will auto-advance to Correction again if the new deadline lapses.
- No change to `finalize-review-request`. Submitter still controls completion.

## Verification

1. As submitter, open a request in Correction → click Re-Submit → confirm the dialog requires a future date and rejects today/past dates.
2. Pick a date 5 days out → request transitions to `pending`, `complete_by` updates, `current_round` increments, reviewer statuses reset, reviewers receive the resubmit email showing the new deadline.
3. Repeat the cycle a third time → round 3 works identically (proves no single-send-back limit).
4. Manually invoke `send-review-reminders` after a resubmit with `complete_by = tomorrow` → the 1-day-before email now sends (proving the reminders-sent purge worked).
5. Let a resubmitted request's deadline pass → nightly auto-close moves it back to Correction with `closed_reason = 'deadline_reached'`; submitter can resubmit again with yet another new date.
