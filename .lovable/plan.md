

## Add Search Filter to Member Selection List

### Change — `src/components/settings/TeamManagement.tsx`

Add a search input above the checkbox list in the "Manage Members" dialog that filters `availableProfiles` by name or email.

1. **New state**: `const [memberSearch, setMemberSearch] = useState("")`
2. **Reset** `memberSearch` to `""` when `openMembers` is called
3. **Filter**: derive `filteredProfiles` from `availableProfiles` using case-insensitive match on `full_name` and `email`
4. **Add `<Input>`** with placeholder "Search users..." above the checkbox list
5. **Render `filteredProfiles`** instead of `availableProfiles` in the list; show "No matching users" when filtered list is empty

### Files Modified
- `src/components/settings/TeamManagement.tsx`

