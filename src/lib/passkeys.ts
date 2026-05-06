import { supabase } from "@/integrations/supabase/client";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

export const passkeysSupported = () =>
  typeof window !== "undefined" && browserSupportsWebAuthn();

export async function registerPasskey(deviceLabel: string) {
  const rpID = window.location.hostname;
  const origin = window.location.origin;

  const { data: optsData, error: optsErr } = await supabase.functions.invoke(
    "passkey-register-options",
    { body: { rpID, rpName: "Review Hub" } }
  );
  if (optsErr) throw new Error(optsData?.error || optsErr.message);
  if (!optsData?.options) throw new Error("Failed to get registration options");

  const attResp = await startRegistration(optsData.options);

  const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
    "passkey-register-verify",
    { body: { response: attResp, rpID, origin, deviceLabel } }
  );
  if (verifyErr) throw new Error(verifyData?.error || verifyErr.message);
  if (!verifyData?.ok) throw new Error(verifyData?.error || "Verification failed");
}

export async function signInWithPasskey(email: string) {
  const rpID = window.location.hostname;
  const origin = window.location.origin;

  const { data: optsData, error: optsErr } = await supabase.functions.invoke(
    "passkey-auth-options",
    { body: { email, rpID } }
  );
  if (optsErr) throw new Error(optsErr.message);
  if (!optsData?.options) throw new Error("Failed to get authentication options");

  const authResp = await startAuthentication(optsData.options);

  const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
    "passkey-auth-verify",
    { body: { response: authResp, rpID, origin } }
  );
  if (verifyErr) throw new Error(verifyErr.message);
  if (!verifyData?.ok || !verifyData?.token_hash) {
    throw new Error(verifyData?.error || "Sign-in failed");
  }

  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: verifyData.token_hash,
  });
  if (otpErr) throw otpErr;
}
