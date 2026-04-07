
-- Drop the overly broad ALL policy for admins
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Admins can still view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

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
