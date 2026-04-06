

## Show Team & Complete-By + Filter by Team Membership

### Overview
Add Team name and Complete By columns to the Dashboard table, show them in RequestDetail, and filter requests so non-admin users only see requests belonging to their team(s) or submitted by them.

### Changes

**`src/pages/Dashboard.tsx`**
- Fetch the user's team IDs from `team_members` on mount
- Build a team name lookup map by fetching from `teams` table
- Filter logic in `fetchRequests`:
  - **Admins**: see all requests (no filter)
  - **Non-admins**: fetch requests where `team_id` is in the user's team IDs, OR `submitted_by` equals the user, OR `team_id` is null
- Add "Team" and "Complete By" columns to the table
- Display team name from the lookup map, and format `complete_by` date

**`src/components/RequestDetail.tsx`**
- Fetch team name from `teams` table using `request.team_id`
- Add Team and Complete By fields to the metadata grid (making it handle the extra rows)
- Show team name or "None" and formatted complete_by date or "Not set"

### Files to modify

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add team/date columns, fetch user teams, filter requests by team membership |
| `src/components/RequestDetail.tsx` | Show team name and complete-by date in the detail view |

No database changes needed.

