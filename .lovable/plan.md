

## Multi-Select Members When Adding to Team

### Problem
Currently, the "Manage Members" dialog uses a single `<Select>` dropdown, allowing only one user to be added at a time.

### Solution
Replace the single-select dropdown with a checkbox list of available users, allowing multiple selections before clicking "Add".

### Changes — `src/components/settings/TeamManagement.tsx`

1. **Replace `selectedUserId` (string) with `selectedUserIds` (string[])** state.

2. **Replace the `<Select>` dropdown** with a scrollable list of available profiles, each with a `<Checkbox>` and user name/email. Something like:
   ```tsx
   <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
     {availableProfiles.map((p) => (
       <label key={p.user_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-sm">
         <Checkbox
           checked={selectedUserIds.includes(p.user_id)}
           onCheckedChange={(checked) => {
             setSelectedUserIds(prev =>
               checked ? [...prev, p.user_id] : prev.filter(id => id !== p.user_id)
             );
           }}
         />
         <span>{p.full_name || p.email}</span>
       </label>
     ))}
   </div>
   ```

3. **Update `addMember`** to insert all selected users at once:
   ```tsx
   const rows = selectedUserIds.map(uid => ({ team_id: membersTarget.id, user_id: uid }));
   const { error } = await supabase.from("team_members").insert(rows);
   ```
   Show toast with count: `"${selectedUserIds.length} member(s) added"`.

4. **Update the Add button** to show count and disable when none selected:
   ```tsx
   <Button disabled={selectedUserIds.length === 0}>
     Add ({selectedUserIds.length})
   </Button>
   ```

### Files Modified
- `src/components/settings/TeamManagement.tsx`

