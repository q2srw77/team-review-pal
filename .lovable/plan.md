## Redesign: Teams → Manage Members dialog

Convert the cramped single-column popup into a wide, two-pane member manager — Available Users on the left, Assigned Members on the right — with clear actions to move users between them.

### Layout

- Widen the dialog: `max-w-4xl`, content height `h-[70vh]` so it feels like a proper management surface.
- Header keeps `Members — {team name}` plus a subtitle showing live counts (e.g. "3 assigned · 12 available").
- Body is a responsive 2-column grid (`md:grid-cols-2`, stacked on mobile) with a subtle divider.

```text
┌───────────────────────────────────────────────────────────┐
│ Members — Design Team        3 assigned · 12 available    │
├───────────────────────────┬───────────────────────────────┤
│ Available (12)            │ Assigned (3)                  │
│ [search…]                 │ [search…]                     │
│ ┌───────────────────────┐ │ ┌───────────────────────────┐ │
│ │ ☐ Alice  alice@x.com →│ │ │ Bob   bob@x.com         × │ │
│ │ ☐ Carol  carol@x.com →│ │ │ Dana  dana@x.com        × │ │
│ │ …                     │ │ │ …                         │ │
│ └───────────────────────┘ │ └───────────────────────────┘ │
│ [Add selected (2)]        │ [Remove selected (0)]         │
└───────────────────────────┴───────────────────────────────┘
                                                    [ Done ]
```

### Available Users pane (left)

- Search input filtering by name/email.
- Scrollable list (`ScrollArea`) of avatar + name + email rows.
- Per-row checkbox plus a quick "→" arrow icon button to add a single user instantly.
- "Select all (filtered)" checkbox in the column header.
- Footer: primary "Add selected (n)" button, disabled when none selected.
- Empty state: "All users are already members" or "No matches".

### Assigned Members pane (right)

- Search input filtering current members.
- Scrollable list of avatar + name + email rows.
- Per-row checkbox plus a "×" icon button for instant removal (existing confirmation toast pattern preserved).
- Footer: destructive "Remove selected (n)" button, disabled when none selected.
- Empty state: "No members yet — add some from the left".

### Interaction details

- Add/remove operations are batched: arrays of `selectedAvailable` and `selectedAssigned` ids.
- After any mutation, refresh both lists, clear selections, keep the dialog open.
- Keep the existing toast notifications and `fetchTeams()` refresh so member counts on the main table update.
- Avatars: use existing `Avatar` component with initials fallback derived from `full_name` or `email`.
- Keyboard: Enter on a search filters; checkbox rows are full-row clickable labels (already the pattern).

### Files to change

- `src/components/settings/TeamManagement.tsx` — only the Manage Members `Dialog` block and its supporting state/handlers. No backend, RLS, or schema changes.

### Out of scope

- No drag-and-drop (kept simple/accessible; can add later).
- No changes to teams CRUD, RLS, or other settings panes.
