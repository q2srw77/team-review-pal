

## Add Archive View to Dashboard

### Overview
Add a toggle/tab on the Dashboard so all users can switch between active requests and their archived requests. Currently, archived requests are filtered out entirely (line 84).

### Changes to `src/pages/Dashboard.tsx`

1. **Add view state**: `const [view, setView] = useState<"active" | "archived">("active")`

2. **Update `fetchRequests`**: Store all fetched data (including archived) in a ref or separate state, then derive the displayed list based on view:
   - `active` view: filter where `status !== "archived"` (current behavior)
   - `archived` view: filter where `status === "archived"`

3. **Add toggle UI**: Between the heading and the table, add two tab-style buttons ("Active" / "Archived") using the existing `Button` component with variant toggling. Show request count for each view.

4. **Visibility rules for non-admins in archived view**: Same as active -- only show requests they submitted, in their teams, or unassigned.

5. **Disable "New Request" button in archived view** (or keep it visible -- it makes sense to keep it always available).

### Single file change: `src/pages/Dashboard.tsx`

