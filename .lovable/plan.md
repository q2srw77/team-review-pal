

## Remove Archive Feature Entirely

### Summary
Remove the "Archived" status, filter tab, archive button, archive cron cleanup, and the `archived_at` column from the entire application.

### Database Migration (1 file)

1. **Remove `archived` from the `request_status` enum** — rename the enum without the `archived` value (Postgres requires creating a new enum, migrating data, and swapping):
   - Update any rows with `status = 'archived'` to `'completed'` (so no data is lost)
   - Create new enum without `archived`, swap columns
2. **Drop the `archived_at` column** from `review_requests`
3. **Drop the `cleanup_old_archived_requests()` function**

```sql
-- Move any archived requests to completed
UPDATE public.review_requests SET status = 'completed' WHERE status = 'archived';

-- Recreate enum without 'archived'
ALTER TYPE public.request_status RENAME TO request_status_old;
CREATE TYPE public.request_status AS ENUM ('pending', 'in_review', 'completed');
ALTER TABLE public.review_requests
  ALTER COLUMN status TYPE public.request_status USING status::text::public.request_status;
DROP TYPE public.request_status_old;

-- Drop archived_at column
ALTER TABLE public.review_requests DROP COLUMN archived_at;

-- Drop cleanup function
DROP FUNCTION IF EXISTS public.cleanup_old_archived_requests();
```

### Frontend Changes

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Remove `archived` from `STATUS_STYLES`, `STATUS_LABELS`, view state type (change to `"active" \| "completed"`), remove `archivedRequests` filter, remove Archived tab button |
| `src/components/RequestDetail.tsx` | Remove `Archive` import, `archiving` state, `archiveRequest` function, Archive button/dialog, remove `archived` from `STATUS_STYLES`/`STATUS_LABELS`, update locked-status checks from `"completed" \| "archived"` to just `"completed"` |
| `src/components/settings/AuditLogs.tsx` | Remove `archived` from action filter dropdown and style map |

### Files Modified
- 1 new migration file
- `src/pages/Dashboard.tsx`
- `src/components/RequestDetail.tsx`
- `src/components/settings/AuditLogs.tsx`

