

## Fix Function Search Path Mutable Warning

### Problem
Four database functions in the `public` schema lack a `SET search_path` configuration, which the Supabase linter flags as a security risk. Without an explicit search path, these functions could be exploited via schema injection.

### Affected Functions
- `enqueue_email`
- `read_email_batch`
- `delete_email`
- `move_to_dlq`

### Fix
One database migration that re-creates all four functions with `SET search_path TO 'public'` added:

```sql
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ ... $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS SETOF pgmq.message LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ ... $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ ... $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue TEXT, dead_letter_queue TEXT, message_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ ... $$;
```

### Scope
- **1 new migration file** — no application code changes needed.

