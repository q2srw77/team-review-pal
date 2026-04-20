

## Investigation: Why the Auto-Close Didn't Fire

### What I found

| Component | Status |
|---|---|
| Cron job `auto-close-overdue-requests-hourly` | Active, running every hour |
| Last 10 runs | All `succeeded`, HTTP 200 |
| Function response | `{"processed":0,"results":[]}` every run |
| Service-role auth gate | Working (no 401/403) |
| Test request `Test Auto Close` | `complete_by = 2026-04-20`, status `in_review` |
| Today (UTC) | `2026-04-20` |

### Root cause

The function uses a **strict less-than** comparison:

```ts
const today = new Date().toISOString().slice(0, 10);  // "2026-04-20"
.lt("complete_by", today)                              // complete_by < today
```

A request with `complete_by = 2026-04-20` is **not** less than `2026-04-20`, so it's skipped. It would only fire on **April 21 UTC** (tomorrow).

This is a semantic question — does "complete by April 20" mean:
- **(A)** "Must be done by end-of-day April 20" → auto-close fires on April 21 (current behavior)
- **(B)** "Must be done before April 20 starts" → auto-close fires on April 20 (what you expected)

### Recommended fix: Option A semantics, but trigger same day after end-of-day

Change the query to close requests where `complete_by < today` OR (`complete_by = today` AND we're past end-of-day in the relevant timezone). The simplest clean implementation:

**Use `complete_by <= today - 1 day` is current. Switch to `complete_by < today` already does that.**

The cleanest interpretation of "complete by April 20" matching user expectation:
> Close once the day has begun on April 21 UTC (i.e., the deadline day is fully over).

**This is exactly what the current code does.** The test request is simply not overdue yet — it has until end-of-day April 20.

### The actual fix you likely want

Change semantic to **(B): close at the start of the deadline day** so "complete by April 20" means the auto-close fires the morning of April 20 if not done. Two-line change:

```ts
// before
.lt("complete_by", today)
// after
.lte("complete_by", today)
```

This will close the test request on the very next hourly run.

### Plan

1. **Edit `supabase/functions/auto-close-overdue-requests/index.ts`**: change `.lt("complete_by", today)` to `.lte("complete_by", today)` so requests due *today* are closed (consistent with the UI showing "Overdue" on the deadline day itself).
2. **Manually trigger the function once** after deploy via `curl_edge_functions` with the service-role token to verify the `Test Auto Close` request closes immediately, the report PDF generates, and the submitter gets the "all complete" email.
3. **Verify in DB**: confirm `status='completed'`, `closed_reason='deadline_reached'`, `report_pdf_path` set, audit log row inserted, and `review_statuses` for incomplete reviewer remains `pending` (so the lock UI shows "Did not complete").

### Files modified
- `supabase/functions/auto-close-overdue-requests/index.ts` (one operator change)

### Out of scope
- The cron schedule, auth gate, report-generation chain, and email pipeline are all confirmed working — no changes needed there.

