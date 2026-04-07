

## Add "Completed" Filter Tab to Dashboard

### Change in `src/pages/Dashboard.tsx`

1. **Update view state type** (line 37): Change from `"active" | "archived"` to `"active" | "completed" | "archived"`.

2. **Update filter logic** (lines 107-108): Split into three groups:
   - `active`: status is `pending` or `in_review`
   - `completed`: status is `completed`
   - `archived`: status is `archived`

3. **Add third button** (lines 124-134): Insert a "Completed" button between Active and Archived with the count.

4. **Update count label** (line 119): Handle the new "completed" view label.

### Single file: `src/pages/Dashboard.tsx`

