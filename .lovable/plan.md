

## Fix: Overdue Warning Icon Showing Yellow Instead of Red

### Problem
The "Test Email Review" request has a Complete By date of Apr 7, 2026 — which is yesterday (Apr 8, 2026 today). It should show a **red** warning icon but is showing **yellow** instead.

### Root Cause
`differenceInDays` from `date-fns` compares timestamps including time components. When `complete_by` is `"2026-04-07"` (a date-only string), `new Date("2026-04-07")` creates midnight UTC. Meanwhile `new Date()` returns the current local time. Depending on timezone, `differenceInDays` may return `0` instead of `-1` for a date that was yesterday, causing it to hit the `days <= 3` (yellow) branch instead of `days < 0` (red).

### Fix — `src/pages/Dashboard.tsx` (line ~216)

Use `startOfDay` from date-fns to normalize both dates before comparison, or switch to `isPast` / `isBefore` with date-only comparison:

```tsx
import { format, differenceInCalendarDays } from "date-fns";

// Replace differenceInDays with differenceInCalendarDays
const days = differenceInCalendarDays(new Date(r.complete_by), new Date());
if (days < 0) return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
if (days <= 3) return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
```

`differenceInCalendarDays` compares calendar dates (ignoring time), so Apr 7 vs Apr 8 will always return `-1` regardless of timezone. This is a single import change and one function name change on one line.

### Files Modified
- `src/pages/Dashboard.tsx` — replace `differenceInDays` with `differenceInCalendarDays`

