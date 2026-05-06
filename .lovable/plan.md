## Add confirmation before removing members

Currently, both the per-row "×" button and the "Remove selected (n)" button in the Manage Members dialog remove members instantly. Add an `AlertDialog` confirmation step before any removal so admins don't accidentally drop members from a team.

### Behavior

- Single remove (× icon on an assigned row) → opens confirm: "Remove {Name} from {Team}?"
- Bulk remove ("Remove selected (n)" button) → opens confirm: "Remove {n} member(s) from {Team}?"
- Confirm action: destructive button labeled "Remove" runs the existing `removeMembersByUserIds` flow.
- Cancel action: closes the dialog, leaves selections untouched.
- Description warns: "They will lose access to this team's review requests. This can be undone by re-adding them."

### Implementation

In `src/components/settings/TeamManagement.tsx`:

- Add state `removeConfirm: { userIds: string[]; label: string } | null`.
- Replace the direct `removeMembersByUserIds([m.user_id])` call on the row × button and the `removeMembersByUserIds(selectedAssigned)` call on the bulk button with setters that open the confirm dialog with the appropriate `userIds` and `label` (member name vs. count).
- Render a single `AlertDialog` inside the Manage Members `Dialog` (controlled by `removeConfirm`) with destructive `AlertDialogAction` that calls `removeMembersByUserIds(removeConfirm.userIds)` then clears `removeConfirm`.

### Out of scope

- No backend, RLS, or schema changes.
- No change to the Add flow (adding stays one-click as it is reversible).
