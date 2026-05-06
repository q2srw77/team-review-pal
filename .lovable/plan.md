# Paginate Active & Completed lists

Add client-side pagination beneath the requests table, defaulting to 25 rows per page with options for 50 and 100.

## What changes

A pagination footer appears below the requests table (inside the same card or directly under it) showing:

- **Left**: "Showing X–Y of Z" (e.g. "Showing 1–25 of 137"). Reflects the currently filtered list, not the unfiltered total.
- **Center / right**: Page navigation — Previous, page indicator ("Page 2 of 6"), Next. Buttons disable at the ends.
- **Right**: "Rows per page" select with options 25 (default), 50, 100.

## Behavior

- Pagination is purely client-side, slicing the existing `requests` (already filtered) array.
- Page resets to 1 whenever filters change (search, platform, status), the tab changes (Active/Completed), or the page-size changes.
- If the current page becomes out of range after a data refresh (e.g. items removed), clamp to the last valid page.
- Hide the footer entirely when total ≤ current page size and total ≤ 25 (no need to show controls for trivial lists). Always show the "Showing X of Y" text when there is at least 1 row.
- Layout: stacks on mobile (`flex-col gap-2`), single row on `sm+` with `justify-between`.

## Files to modify

- `src/pages/Dashboard.tsx`
  - Add state: `page` (number), `pageSize` (25 | 50 | 100).
  - Add `useEffect` to reset `page` to 1 on filter/tab/pageSize changes.
  - Derive `pagedRequests` via `useMemo`, render those in the table body instead of `requests`.
  - Render a `<PaginationFooter>` block (inline JSX, no new file needed) below the table.

No new dependencies — uses existing `Button` and `Select` components.

## Out of scope

- Server-side pagination.
- Persisting page size across sessions.
- URL-synced pagination state.
