CREATE TABLE public.password_reset_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_token_hash ON public.password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Service role only (no policies = no authenticated access; service role bypasses RLS)
CREATE POLICY "Service role can manage password reset tokens"
ON public.password_reset_tokens
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Validation trigger ensures expires_at is in the future relative to created_at
CREATE OR REPLACE FUNCTION public.validate_password_reset_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'expires_at must be after created_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_password_reset_token
BEFORE INSERT OR UPDATE ON public.password_reset_tokens
FOR EACH ROW EXECUTE FUNCTION public.validate_password_reset_token();