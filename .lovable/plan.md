

## Fix Edit Button Overlapping Close (X) Button

### Problem
In the `Sheet` detail panel, the Edit button sits in the top-right corner of the `SheetHeader`, which overlaps with the Sheet's built-in close X button (rendered by `SheetContent` at `absolute right-4 top-4`).

### Fix — `src/components/RequestDetail.tsx` (line ~382)

Add right padding to the header's flex container so the Edit/Cancel/Save buttons don't overlap the Sheet's close X:

```tsx
<div className="flex items-start justify-between gap-2 pr-8">
```

This adds `pr-8` (2rem / 32px) of right padding to the header row, giving the close X button enough clearance. Single line change.

