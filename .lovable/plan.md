# Search & Filter Controls for Review Requests

Add a controls row to the Dashboard so users can quickly narrow down the requests table.

## What changes

A new toolbar appears above the requests table (between the Active/Completed tabs and the table itself) with three controls:

1. **Search by title** — text input with a search icon. Filters the current view (Active or Completed) to rows whose title contains the typed text (case-insensitive). Includes a clear (×) button when text is present.
2. **Platform filter** — dropdown listing "All platforms" plus every platform currently present in the loaded requests (built from the data so it stays accurate even if a platform is later removed from the catalog).
3. **Status filter** — dropdown with options:
   - In the Active tab: "All active", "Pending", "In Review"
   - In the Completed tab: hidden (status is already implied) — keeps the bar clean.

A small helper line on the right shows "Showing X of Y" so users see how much was filtered. A "Clear filters" link appears only when at least one filter is active.

## Behavior details

- All filtering is **client-side** on the existing `allRequests` state — no extra Supabase queries.
- Filters apply on top of the existing Active/Completed split and the existing role-based visibility rules.
- Switching between Active and Completed tabs preserves the search text and platform filter; the status filter resets because its options change.
- Layout: stacks vertically on mobile (`flex-col`), single row on `sm+` (`sm:flex-row`), with the search input growing (`flex-1`) and the two selects at fixed widths.
- Empty result state: when filters return zero rows (but unfiltered would have rows), show a small inline message "No requests match your filters" with a "Clear filters" button instead of the existing "No review requests yet" empty card.

## Files to modify

- `src/pages/Dashboard.tsx` — add filter state (`search`, `platformFilter`, `statusFilter`), derive `filteredRequests` via `useMemo`, render the toolbar, and feed the filtered list into the table + count.

No backend, schema, or RLS changes. No new dependencies — uses existing `Input`, `Select`, and `lucide-react` icons (`Search`, `X`).

## Out of scope

- Saving filter state across sessions.
- Filtering by team, submitter, or date range (can be added later if needed).
- Server-side filtering / pagination.
