

## Add Archive & Delete Buttons for Submitter/Admin

### Overview
Add "Archive" and "Delete" buttons to the RequestDetail sheet, visible only to the submitter and admins. Both require confirmation dialogs before executing.

### Database Changes

1. **Add `archived` to `request_status` enum** via migration:
   ```sql
   ALTER TYPE public.request_status ADD VALUE 'archived';
   ```

2. **Add DELETE RLS policy** on `review_requests`:
   ```sql
   CREATE POLICY "Submitters can delete own requests"
   ON public.review_requests FOR DELETE TO authenticated
   USING (auth.uid() = submitted_by);

   CREATE POLICY "Admins can delete requests"
   ON public.review_requests FOR DELETE TO authenticated
   USING (has_role(auth.uid(), 'admin'::app_role));
   ```

3. **Add DELETE policy on `review_statuses`** (cascade cleanup):
   ```sql
   CREATE POLICY "Service role can delete review statuses"
   ON public.review_statuses FOR DELETE TO public
   USING (auth.role() = 'service_role'::text);
   ```
   Also add a foreign key or use application-level cleanup to delete related `review_statuses` and `request_notes` when a request is deleted. Simplest: add `ON DELETE CASCADE` foreign keys on `review_statuses.request_id` and `request_notes.request_id` referencing `review_requests.id`.

### Changes to `src/components/RequestDetail.tsx`

1. **Import** `AlertDialog` components, `Archive` and `Trash2` icons
2. **Add state**: `archiving`, `deleting` booleans
3. **Archive handler**: Updates `review_requests.status` to `'archived'`, calls `onUpdated()` and `onClose()`
4. **Delete handler**: Deletes related `review_statuses` and `request_notes` first, then deletes the `review_requests` row, calls `onUpdated()` and `onClose()`
5. **UI**: Add an action bar at the bottom of the sheet (visible to submitter/admin only) with:
   - "Archive" button (outline, amber) wrapped in `AlertDialog` with confirmation
   - "Delete" button (destructive) wrapped in `AlertDialog` with confirmation warning that this is permanent

### Changes to `src/pages/Dashboard.tsx`

1. **Filter out archived requests** from the default view (or add a toggle to show/hide archived)
2. **Add `STATUS_STYLES` and `STATUS_LABELS`** entry for `archived`

### Changes to `src/components/RequestDetail.tsx` status maps

Add `archived` entry to `STATUS_STYLES` and `STATUS_LABELS`.

### Files to modify

| File | Change |
|------|--------|
| New migration | Add `archived` enum value, DELETE policies, cascade FKs |
| `src/components/RequestDetail.tsx` | Archive/Delete buttons with AlertDialog confirmations |
| `src/pages/Dashboard.tsx` | Add archived status style, filter archived from default view |

