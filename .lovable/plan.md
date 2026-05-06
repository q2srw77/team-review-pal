Add a rename action to each passkey row in `src/components/profile/PasskeySettings.tsx`.

1. Add a pencil/edit icon button next to the existing trash icon on each passkey row.
2. Clicking it opens a small dialog (reuse `AlertDialog` style or a simple modal) with an `Input` pre-filled with the current `device_label` (max 80 chars).
3. On save, run `supabase.from("user_passkeys").update({ device_label: newLabel }).eq("id", passkey.id)`, show a toast, then `load()` to refresh.
4. Validate: trim, require non-empty, cap at 80 chars.

No backend or RLS changes needed — users already have update access to their own passkey rows via the existing service-role/self policies (the user owns the row via `user_id = auth.uid()`).

Technical detail: confirm/add a self-update RLS policy on `user_passkeys` if updates are blocked. Current policies only show SELECT and DELETE for the owner; if the update fails, add a migration:
```sql
CREATE POLICY "Users can update own passkey label"
ON public.user_passkeys FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```