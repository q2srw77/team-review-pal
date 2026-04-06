

## Allow Submitter to Edit Review Request

### Overview
Add an "Edit" mode to the RequestDetail sheet so the original submitter can modify their review request fields (title, platform, URL, notes, complete-by date). Team is excluded from editing since changing it would require re-creating reviewer statuses.

### Changes to `src/components/RequestDetail.tsx`

1. **Add editing state**: `editing` boolean, plus local state for editable fields (`editTitle`, `editPlatform`, `editUrl`, `editNotes`, `editCompleteBy`)
2. **Load platforms list**: Fetch from `platforms` table when entering edit mode (for the platform dropdown)
3. **Toggle edit mode**: Show an "Edit" button in the sheet header when `user.id === request.submitted_by` and request is not completed
4. **Edit UI**: When `editing` is true, replace the read-only metadata fields with editable inputs:
   - Title: Input field
   - Platform: Select dropdown
   - URL: Input field
   - Notes: Textarea
   - Complete By: Calendar date picker (same pattern as RequestForm)
   - Team: shown as read-only (not editable)
5. **Save handler**: Update `review_requests` with the edited fields via Supabase, call `onUpdated()`, exit edit mode
6. **Cancel**: Reset local state to original request values, exit edit mode

### No database changes needed
The existing RLS policy "Submitters can update own requests" already allows `auth.uid() = submitted_by` to update their own rows.

### Files to modify

| File | Change |
|------|--------|
| `src/components/RequestDetail.tsx` | Add edit mode with inline form fields for submitter |

