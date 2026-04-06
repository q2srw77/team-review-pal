

## Sort by Complete By + Deadline Warning Icon

### Overview
Sort dashboard requests by `complete_by` date (soonest first, nulls last) and show a yellow warning icon next to the title when a request is within 3 days of its deadline.

### Changes to `src/pages/Dashboard.tsx`

1. **Sort requests**: After filtering out archived requests, sort by `complete_by` ascending. Requests without a `complete_by` date go to the bottom.

2. **Warning icon**: Import `AlertTriangle` from lucide-react. In the title cell, check if `complete_by` is set and within 3 days from now (and not past). If so, render a yellow `AlertTriangle` icon inline to the right of the title text.

3. **Logic**: `differenceInDays(parseDate(r.complete_by), new Date()) <= 3` using date-fns (already imported). Also include overdue requests (difference < 0) as they should also show the warning.

### Single file change: `src/pages/Dashboard.tsx`

