## Goal
Add a search box to Settings → Audit Logs that filters entries by **action** or **entity type** (and, as a small bonus, user name) alongside the existing action dropdown.

## Changes (single file: `src/components/settings/AuditLogs.tsx`)

### 1. Search input
- Add a `search` state string.
- Render a search `Input` with a `Search` icon (lucide) to the left of the existing action filter, in the same header row. Placeholder: "Search action, entity, or user…".
- Width: `w-64` on desktop, full-width on mobile (`flex-col sm:flex-row` wrapper).

### 2. Server-side filtering
- Refetch when `search` changes (add to `useEffect` deps), and reset `page` to 0.
- Build the Supabase query with an `.or(...)` clause when `search` is non-empty:
  - `action.ilike.%term%`
  - `entity_type.ilike.%term%`
  - `user_name.ilike.%term%`
- Debounce the input by ~300 ms (simple `setTimeout` in a `useEffect`) so we don't refetch on every keystroke.

### 3. Empty state
- Keep the existing "No audit logs found." row; it already covers the empty search case.

## Out of scope
- Searching inside the JSON `details` field (would require server-side JSON casting; can add later if needed).
- Changes to the details dialog, pagination, or any other settings page.
