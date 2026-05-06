
-- Passkey credentials owned by users
CREATE TABLE public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_label text NOT NULL DEFAULT 'Passkey',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX idx_user_passkeys_user_id ON public.user_passkeys(user_id);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own passkeys"
ON public.user_passkeys FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own passkeys"
ON public.user_passkeys FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages passkeys"
ON public.user_passkeys FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Short-lived challenges for WebAuthn ceremonies
CREATE TABLE public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  challenge text NOT NULL,
  type text NOT NULL CHECK (type IN ('registration','authentication')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_passkey_challenges_challenge ON public.passkey_challenges(challenge);

ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages passkey challenges"
ON public.passkey_challenges FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Track when password sign-in is disabled (passkey-only accounts)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password_disabled boolean NOT NULL DEFAULT false;
