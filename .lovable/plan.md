# Inline filter controls with the Active/Completed tabs

Move the search box, platform dropdown, and status dropdown onto the same row as the Active/Completed segmented buttons, aligned to the right.

## What changes

- Wrap the Active/Completed segmented control and the filter controls in a single flex row with `justify-between`.
  - Left: existing Active/Completed segmented control.
  - Right: search input + platform select + status select (Active tab only) + Clear button.
- Shrink the search input from `flex-1` to a fixed compact width (~`w-56`, `lg:w-64`) so it doesn't push the dropdowns around.
- Tighten the dropdown widths (`w-40` / `w-36`) for a more balanced look on the same line.
- On mobile (`<sm`), the row stacks: tabs on top, then a wrapped filter group underneath, so nothing gets squished.

## Files to modify

- `src/pages/Dashboard.tsx` — restructure the toolbar markup; remove the standalone filter row and merge it into the tabs row.

No state/logic changes — same filter behavior, just relocated and resized.
