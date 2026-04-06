

## Add Reviewer Progress Indicator to Dashboard Table

### Overview
Add a "Progress" column to the dashboard table showing a fraction (e.g., "2/4") with a small progress bar for each review request.

### Changes to `src/pages/Dashboard.tsx`

1. **Fetch reviewer progress data**: After fetching requests, batch-query `review_statuses` for all request IDs. Group by `request_id` to compute `completed` count and `total` count per request. Store in a `Map<string, {completed: number, total: number}>`.

2. **Add "Progress" column**: Insert a new table header between "Status" and "Submitted". Each cell shows:
   - Text fraction: `2/4`
   - A small `Progress` bar component (already exists in `src/components/ui/progress.tsx`) underneath, colored by completion percentage

3. **Import** the `Progress` component from `@/components/ui/progress`

### Single file change: `src/pages/Dashboard.tsx`

