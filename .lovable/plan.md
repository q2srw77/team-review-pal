

## Admin Role Simplification

### What changes

**Display**: When a user has the `admin` role, only show "Admin" as their badge — hide any other roles from display.

**Access**: Make `isReviewer` true when the user is an admin, so admins automatically get reviewer capabilities (status changes, adding notes). Submit access is already available to all authenticated users, so no change needed there.

### Files to modify

**`src/hooks/useAuth.tsx`**
- Change `setIsReviewer` logic: `setIsReviewer(roleList.includes("reviewer") || roleList.includes("admin"))`

**`src/pages/Dashboard.tsx`**
- Filter displayed roles: if `roles` includes `admin`, only show `["admin"]`; otherwise show all roles

**`src/pages/Settings.tsx`**
- Same display logic for the roles column in the users table: if a user has `admin`, only show the Admin badge

No database or edge function changes needed.

