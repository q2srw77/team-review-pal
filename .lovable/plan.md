

## Auto-Delete Archived Requests After 6 Months

### Overview
Automatically remove review requests that have been in "archived" status for more than 6 months using a scheduled database job.

### Approach
Use a `pg_cron` job that runs daily to delete archived requests older than 6 months. This keeps it entirely in the database layer with no edge function needed.

### Database Changes

1. **Add `archived_at` column** to `review_requests` via migration — tracks when a request was archived:
   ```sql
   ALTER TABLE public.review_requests ADD COLUMN archived_at timestamptz;
   ```

2. **Create cleanup function** via migration:
   ```sql
   CREATE OR REPLACE FUNCTION public.cleanup_old_archived_requests()
   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
   AS $$ BEGIN
     DELETE FROM public.review_requests
     WHERE status = 'archived' AND archived_at < now() - interval '6 months';
   END; $$;
   ```

3. **Schedule daily cron job** via the insert tool (not migration):
   ```sql
   SELECT cron.schedule('cleanup-archived-requests', '0 3 * * *',
     $$SELECT public.cleanup_old_archived_requests()$$);
   ```

### Code Changes

**`src/components/RequestDetail.tsx`** — In the `archiveRequest` function, set `archived_at: new Date().toISOString()` alongside `status: "archived"` in the update call.

### Files to modify

| File | Change |
|------|--------|
| New migration | Add `archived_at` column + cleanup function |
| Insert query | Schedule daily cron job |
| `src/components/RequestDetail.tsx` | Set `archived_at` when archiving |

