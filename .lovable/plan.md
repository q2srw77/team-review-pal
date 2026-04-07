

## Fix: New Requests Not Showing on Dashboard

### Root Cause

Race condition between auth/role loading and data fetching.

The `fetchRequests` callback depends on `isAdmin` (line 62) to decide whether to fetch all requests or apply a client-side team filter. However, the `useEffect` that triggers it (line 119-121) only depends on `[user, userTeamIds]` — **not** `isAdmin`:

```
useEffect(() => {
    if (user) fetchRequests();
  }, [user, userTeamIds]);  // <-- missing isAdmin
```

Timeline of the bug:
1. Auth restores session → `user` is set, but `isAdmin` is still `false` (roles haven't loaded yet)
2. Dashboard effect fires → calls `fetchRequests` with `isAdmin = false`
3. `fetchRequests` takes the non-admin path, applies client-side filter with `userTeamIds = []`
4. Only requests where `submitted_by === user.id` or `team_id === null` are shown
5. Roles load → `isAdmin` becomes `true`, but the effect **never re-runs** because `isAdmin` isn't in its dependency array
6. `userTeamIds` loads → effect re-runs, but `isAdmin` may or may not be `true` yet (race)

### Fix — `src/pages/Dashboard.tsx`

Two changes on lines 119-121:

1. Gate the fetch on `!loading` (from `useAuth`) so we don't fetch before roles are known
2. Add `isAdmin` to the dependency array so the fetch re-runs when the role resolves

```tsx
const { user, signOut, isAdmin, roles, profileName, loading } = useAuth();
```

```tsx
useEffect(() => {
    if (user && !loading) fetchRequests();
  }, [user, userTeamIds, isAdmin, loading]);
```

### Files Modified
- `src/pages/Dashboard.tsx` (2 line changes)

