

## Sort Completed Requests to Bottom of Active View

### Change in `src/pages/Dashboard.tsx` (lines 86-91)

Replace the current sort with a two-tier sort:
1. **Primary**: Completed requests sink to the bottom (status `completed` gets weight 1, others get 0)
2. **Secondary**: Within same tier, sort by `complete_by` date ascending (nulls last)

```typescript
all.sort((a, b) => {
  const aCompleted = a.status === "completed" ? 1 : 0;
  const bCompleted = b.status === "completed" ? 1 : 0;
  if (aCompleted !== bCompleted) return aCompleted - bCompleted;
  if (!a.complete_by && !b.complete_by) return 0;
  if (!a.complete_by) return 1;
  if (!b.complete_by) return -1;
  return new Date(a.complete_by).getTime() - new Date(b.complete_by).getTime();
});
```

### Single file change: `src/pages/Dashboard.tsx`

