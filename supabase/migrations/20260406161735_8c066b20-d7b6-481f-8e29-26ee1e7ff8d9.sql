
CREATE OR REPLACE FUNCTION public.backfill_profile_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.user_id = u.id
    AND (p.email IS NULL OR p.email = '');
END;
$$;

SELECT public.backfill_profile_emails();

DROP FUNCTION public.backfill_profile_emails();
