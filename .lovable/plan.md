

## Red Warning Icon for Overdue Requests

### Change — `src/pages/Dashboard.tsx` (around line 163)

Update the deadline warning icon logic: currently shows a yellow `AlertTriangle` when ≤3 days remain. Split into two conditions:

- **Overdue** (past `complete_by`): red `AlertTriangle`
- **Due soon** (≤3 days remaining, not yet past): yellow `AlertTriangle` (existing behavior)

```tsx
{r.complete_by && r.status !== "completed" && (() => {
  const days = differenceInDays(new Date(r.complete_by), new Date());
  if (days < 0) return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
  if (days <= 3) return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  return null;
})()}
```

### Files Modified
- `src/pages/Dashboard.tsx`

