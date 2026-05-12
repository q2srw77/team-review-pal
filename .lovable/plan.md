## Goal

Make it obvious to **reviewers** (and everyone else) when a Request is approaching, has reached, or has passed its `complete_by` deadline — i.e. when the daily auto-advance cron will kick the request into Correction. The "Complete By" date is already shown in the Meta grid, but there's no visual urgency or status, so reviewers don't realize the clock is running out.

## Scope

UI/presentation only. No business logic, schema, RLS, or backend changes. Everything is derived from the existing `review_requests.complete_by` column.

## Changes

All in `src/components/RequestDetail.tsx`.

### 1. Deadline indicator badge (next to "Complete By")

Compute `daysUntilDeadline = differenceInCalendarDays(complete_by, today)` (use `date-fns`, already imported). Render an inline badge to the right of the formatted date with these tiers:

| Condition (status is `pending` or `in_review`)             | Badge text          | Tone (semantic token)             |
|------------------------------------------------------------|---------------------|------------------------------------|
| `daysUntilDeadline > 7`                                    | none                | —                                  |
| `4 ≤ daysUntilDeadline ≤ 7`                                | "Due in N days"     | muted / default                    |
| `1 ≤ daysUntilDeadline ≤ 3`                                | "Due in N days" (or "Due tomorrow" if 1) | `--status-pending` (amber)         |
| `daysUntilDeadline === 0`                                  | "Due today"         | `--status-pending` solid           |
| `daysUntilDeadline < 0`                                    | "Overdue — auto-advances soon" | `--destructive`                    |

When `status` is `correction` or `completed`, suppress the badge (the request already moved past the auto-advance window).

Use a small `Badge` (variant outline) with an icon (`Clock` for upcoming, `AlertTriangle` for overdue — both already in `lucide-react`).

### 2. Deadline banner for reviewers when overdue or due-today

Above the "Reviewer Progress" section, when the request is `pending`/`in_review` AND `daysUntilDeadline <= 0`, show a one-line banner:

- Overdue (`< 0`): "This request is past its complete-by date. Tonight's auto-advance will mark any incomplete reviewers as complete and move it to Correction."
- Due today (`=== 0`): "This request is due today. If reviewers don't finish, tonight's auto-advance will move it to Correction."

Same color tokens as the badge tier above. Hide for submitter-only views? No — it's relevant to the submitter too (they can extend the date). Show to everyone, but only render at all for the affected statuses.

### 3. "Auto-advances on" hint under the date

Below the Complete By date (small muted text, only when `status` is `pending`/`in_review` and a date is set):

> Auto-advances to Correction after this date.

Keeps the rule discoverable without requiring an overdue state.

## Out of scope

- No new column, no per-request override of the cron schedule.
- No precise countdown to the cron run time (the cron is daily; "tonight" is accurate enough).
- No changes to the Dashboard list view (separate request if wanted).
- No notification/email changes.
- No edit-mode changes — the existing date picker stays as-is.

## Verification

1. Open a request with `complete_by` 5 days out → Meta shows "Due in 5 days" muted.
2. Edit `complete_by` to today → badge becomes amber "Due today" + banner appears above Reviewer Progress.
3. Edit to yesterday → red "Overdue — auto-advances soon" badge + red banner.
4. Move request to Correction or Completed → badge and banner disappear, only the date remains.
5. Reviewer with their own visibility-restricted view sees the same indicator.
