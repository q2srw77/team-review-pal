

## Add Audit Logs and Email Logs to Settings

### Overview
Add two new sections to the Settings sidebar: "Audit Logs" (tracking all request-related actions and who performed them) and "Email Logs" (showing email send history from the existing `email_send_log` table).

### Database Changes

**New `audit_logs` table** via migration:
```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

**RLS policy on `email_send_log`** for admin read access:
```sql
CREATE POLICY "Admins can read email send log"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### Frontend Changes

**`src/components/settings/AuditLogs.tsx`** (new file)
- Fetches from `audit_logs` table, ordered by `created_at` desc
- Table columns: Timestamp, User, Action, Entity Type, Details
- Filterable by action type (created, updated, deleted, archived)
- Paginated (50 per page)

**`src/components/settings/EmailLogs.tsx`** (new file)
- Fetches from `email_send_log` table, ordered by `created_at` desc
- Deduplicates by `message_id` (shows latest status per email)
- Table columns: Timestamp, Template, Recipient, Status (color-coded badge), Error
- Status badges: green=sent, red=failed/dlq, yellow=pending, gray=suppressed
- Paginated (50 per page)

**`src/pages/Settings.tsx`**
- Extend `Section` type with `"audit-logs" | "email-logs"`
- Add nav items with `FileText` and `Mail` icons
- Import and render the two new components

**Audit log insertion points** -- add `supabase.from("audit_logs").insert(...)` calls in:
- `src/components/RequestForm.tsx` -- on request creation (action: "created")
- `src/components/RequestDetail.tsx` -- on edit save (action: "updated"), archive (action: "archived"), delete (action: "deleted"), reviewer status change (action: "review_status_changed")

### Files to modify/create

| File | Change |
|------|--------|
| New migration | Create `audit_logs` table + RLS; add admin SELECT policy on `email_send_log` |
| `src/components/settings/AuditLogs.tsx` | New component for audit log viewer |
| `src/components/settings/EmailLogs.tsx` | New component for email log viewer |
| `src/pages/Settings.tsx` | Add two new sidebar sections |
| `src/components/RequestForm.tsx` | Insert audit log on request creation |
| `src/components/RequestDetail.tsx` | Insert audit logs on edit, archive, delete, status change |

