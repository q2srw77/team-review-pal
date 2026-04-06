

## Per-Reviewer Status Tracking

### Problem
Currently, any reviewer can change the global request status to "completed," which marks the entire review as done even if other team members haven't reviewed it yet.

### Solution
Introduce per-reviewer completion tracking. Each team member marks their own review as done. The overall request status automatically becomes "completed" only when all team members have finished.

### Database Changes

**New table: `review_statuses`**
- `id` (uuid, PK)
- `request_id` (uuid, FK to review_requests, not null)
- `reviewer_id` (uuid, not null — the user marking their status)
- `status` (text, not null, default 'pending' — values: 'pending', 'in_review', 'completed')
- `updated_at` (timestamptz, default now())
- Unique constraint on (request_id, reviewer_id)
- RLS: SELECT for authenticated; INSERT/UPDATE for the reviewer themselves (reviewer_id = auth.uid()) who also has reviewer role

**Auto-populate trigger**: When a review_request is inserted, automatically create a `review_statuses` row for each member of the assigned team (from `team_members`).

**Auto-update trigger on `review_statuses`**: After any update to `review_statuses`, check if ALL reviewers for that request are "completed." If yes, set `review_requests.status` to 'completed'. If any are 'in_review', set to 'in_review'. Otherwise keep 'pending'.

### UI Changes

**`src/components/RequestDetail.tsx`**
- Fetch `review_statuses` for the current request, joined with profiles for names
- Show a "Reviewer Progress" section listing each reviewer with their individual status
- If the current user is a reviewer on this request, show a status dropdown for **their own** status only (not the global one)
- Remove the global status dropdown for reviewers — the overall status is now computed automatically
- Show overall status as a read-only badge for everyone

**`src/pages/Dashboard.tsx`**
- No major changes — the overall `review_requests.status` field still drives the table badge (it's now auto-computed)

### Files to create/modify

| File | Change |
|------|--------|
| New migration | Create `review_statuses` table, triggers for auto-populate and auto-update |
| `src/components/RequestDetail.tsx` | Per-reviewer status UI, remove global status dropdown |

