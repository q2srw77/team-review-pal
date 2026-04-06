

## Fix PDF Generation and Email Notification on Review Completion

### Problem
When all reviewers mark a request as "completed", the database trigger `auto_update_request_status` attempts to call the `generate-review-report` edge function via `extensions.http_post`. This fails silently because:

1. The **`http` extension** is not enabled in the database
2. The **vault secrets** `supabase_url` and `supabase_service_role_key` are not stored in `vault.secrets`, so the trigger gets NULLs and skips the HTTP call entirely

Additionally, `email_send_log` is empty, confirming no emails have been sent yet.

### Root Cause Chain
```text
Reviewer marks "completed"
  → trigger auto_update_request_status fires
    → reads vault secrets → both NULL
      → skips http_post call entirely
        → generate-review-report never invoked
          → no PDF created, no report email sent
```

The instant "all complete" notification (sent from the client in RequestDetail.tsx) also appears to have not reached the queue -- likely because the `send-transactional-email` edge function call succeeded but the queue dispatcher may not be processing.

### Fix: Database Migration

Create a migration that:

1. **Enable the `http` extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
   ```

2. **Store vault secrets** for the trigger to use:
   ```sql
   SELECT vault.create_secret(
     current_setting('app.settings.supabase_url', true),
     'supabase_url'
   );
   SELECT vault.create_secret(
     current_setting('app.settings.supabase_service_role_key', true), 
     'supabase_service_role_key'
   );
   ```

   Note: Since we can't access the actual values via migration, we need to use the secrets tool to insert them into the vault directly. Alternatively, refactor the approach.

**Better approach**: Since vault secrets can't be easily set via migrations, and the `http` extension + vault pattern is fragile, a more reliable fix is to **move the PDF generation call to the client side** (in `RequestDetail.tsx`), similar to how the instant notification already works.

### Revised Approach: Client-Side PDF Generation Trigger

Instead of relying on the database trigger + vault + http extension, invoke `generate-review-report` from the client when all reviewers complete:

**`src/components/RequestDetail.tsx`** -- In the `updateMyReviewStatus` function, after detecting all reviewers are complete (line ~339), add:
```typescript
// Trigger PDF report generation
await supabase.functions.invoke("generate-review-report", {
  body: { request_id: request.id },
});
```

This is placed right after the "review-all-complete" instant notification email, so the flow becomes:
1. All reviewers complete → send instant notification email ✓ (already implemented)
2. Then trigger PDF generation → which also sends the "review-completed" email with download link

**`auto_update_request_status` trigger** -- Remove the `http_post` block from the trigger since it's no longer needed (the client handles it). This simplifies the trigger to just update the request status.

### Migration: Simplify the Trigger

```sql
CREATE OR REPLACE FUNCTION public.auto_update_request_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  total_count int; completed_count int; in_review_count int; new_status text;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'completed'),
         count(*) FILTER (WHERE status = 'in_review')
  INTO total_count, completed_count, in_review_count
  FROM public.review_statuses WHERE request_id = NEW.request_id;

  IF total_count > 0 AND completed_count = total_count THEN new_status := 'completed';
  ELSIF in_review_count > 0 OR completed_count > 0 THEN new_status := 'in_review';
  ELSE new_status := 'pending';
  END IF;

  UPDATE public.review_requests SET status = new_status::request_status
  WHERE id = NEW.request_id;

  RETURN NEW;
END; $$;
```

### Email Verification

Also verify the `process-email-queue` cron job exists so queued emails actually get sent:
- Check `cron.job` for the `process-email-queue` entry
- If missing, call `setup_email_infra` to create it

### Files to modify

| File | Change |
|------|--------|
| New migration | Simplify `auto_update_request_status` trigger (remove http_post block) |
| `src/components/RequestDetail.tsx` | Add `generate-review-report` invocation after all-complete check |

