

## Display All User Roles in Dashboard Header

### Changes

**`src/hooks/useAuth.tsx`**
- Add a `roles: AppRole[]` array to the auth context (derived from the `user_roles` query that already runs)
- Export it alongside the existing `isReviewer`/`isAdmin` booleans

**`src/pages/Dashboard.tsx`**
- Import `roles` from `useAuth`
- Replace the single `{isReviewer && <Badge>Reviewer</Badge>}` with a loop over all roles, rendering a badge for each

### Technical detail

In `useAuth`, the `fetchUserData` effect already queries `user_roles`. Instead of only deriving booleans, also store the raw role strings:

```ts
const roleList = roles?.map(r => r.role) ?? [];
setUserRoles(roleList);
setIsReviewer(roleList.includes("reviewer"));
setIsAdmin(roleList.includes("admin"));
```

In Dashboard header, replace the single badge with:
```tsx
{roles.map(role => (
  <Badge key={role} variant="outline" className="text-xs border-accent text-accent capitalize">
    {role}
  </Badge>
))}
```

### Files modified
| File | Change |
|------|--------|
| `src/hooks/useAuth.tsx` | Add `roles` array to context |
| `src/pages/Dashboard.tsx` | Render all role badges |

