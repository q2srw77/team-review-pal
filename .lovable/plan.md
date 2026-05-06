## Goal

Add a Full Screen toggle to the review detail panel (the side sheet that opens when a review is clicked), placed immediately to the left of the existing X-close button in the top-right corner.

## Changes

**`src/components/RequestDetail.tsx`**
- Add local `isFullScreen` state, defaulting to `false`. Reset to `false` whenever the sheet closes or a different request is selected.
- Apply a conditional className on `<SheetContent>`:
  - Default (current): `sm:max-w-lg overflow-y-auto`
  - Full screen: override width/positioning so the panel fills the viewport (e.g. `!max-w-none w-screen h-screen sm:max-w-none inset-0`).
- Render a new icon button absolutely positioned at `top-4 right-12` (just left of the built-in X at `right-4`), using lucide `Maximize2` / `Minimize2` icons that toggle `isFullScreen`. Style matches the existing close button (ghost, small, `h-7 w-7`).
- Add an `aria-label` ("Enter full screen" / "Exit full screen") and a tooltip-equivalent `title` for accessibility.

## Out of scope

- No changes to the underlying shadcn `Sheet` primitive.
- No changes to content layout inside the sheet — when full screen, content simply has more horizontal room (existing internal sections remain stacked as today).
- No persistence of the full-screen preference across sessions.

## Visual reference

```text
┌──────────────────────────────── Review Detail ────────┐
│                                       [⛶ Fullscreen] [✕]│
│ Title …                                                │
│ …                                                      │
└────────────────────────────────────────────────────────┘
```
