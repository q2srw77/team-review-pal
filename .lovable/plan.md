

## Fix Privilege Escalation on `user_roles` Table

### Problem
The `user_roles` table relies solely on an `ALL` policy for admins. While Postgres RLS should deny inserts for non-admins by default, best practice is to add an explicit INSERT policy restricting writes to `service_role` only — since all role provisioning already goes through edge functions (`setup-admin`, `invite-user`, `manage-user`) that use the service role key.

### Fix
One database migration adding three policies for defense-in-depth:

```sql
-- Only service_role (edge functions) can insert roles
CREATE POLICY "Service role can insert user roles"
ON public.user_roles FOR INSERT TO service_role
WITH CHECK (true);

-- Only service_role can update roles
CREATE POLICY "Service role can update user roles"
ON public.user_roles FOR UPDATE TO service_role
USING (true) WITH CHECK (true);

-- Only service_role can delete roles
CREATE POLICY "Service role can delete user roles"
ON public.user_roles FOR DELETE TO service_role
USING (true);
```

The existing "Admins can manage roles" `ALL` policy should be replaced with a SELECT-only policy so admins can still **view** all roles but cannot directly write to the table from the client:

```sql
DROP POLICY "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

### Scope
- **1 migration file** — no application code changes needed (all role mutations already use edge functions with service role).

