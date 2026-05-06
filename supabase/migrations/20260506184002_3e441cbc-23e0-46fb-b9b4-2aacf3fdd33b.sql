CREATE POLICY "Users can update own passkey label"
ON public.user_passkeys FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);