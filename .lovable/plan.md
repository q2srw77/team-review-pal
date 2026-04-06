

## Add Team Dropdown and Complete By Date to Review Request Form

### Database Changes

**Migration: Add two columns to `review_requests`**
- `team_id` (uuid, nullable, FK to teams.id on delete set null)
- `complete_by` (date, nullable)

### UI Changes

**`src/components/RequestForm.tsx`**
- Fetch teams from the `teams` table (same pattern as platforms fetch)
- Add a "Team" Select dropdown after the Platform field
- Add a "Complete By" date picker using the Popover + Calendar pattern after the URL field
- Include `team_id` and `complete_by` in the insert payload
- Reset both new fields in the `reset()` function

### Files to modify

| File | Change |
|------|--------|
| New migration | Add `team_id` and `complete_by` columns to `review_requests` |
| `src/components/RequestForm.tsx` | Add Team dropdown and Complete By date picker |

