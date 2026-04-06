-- Drop the client-side INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

-- Add service-role-only INSERT policy
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');
