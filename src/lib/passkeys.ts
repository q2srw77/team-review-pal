import { supabase } from "@/integrations/supabase/client";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

export const passkeysSupported = () =>
  typeof window !== "undefined" && browserSupportsWebAuthn();

async function readInvokeError(err: any, fallback: string): Promise<string> {
  try {
    const body = await err?.context?.response?.json?.();
    if (body?.error) return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
  } catch {}
  return err?.message || fallback;
}

export async function registerPasskey(deviceLabel: string) {
  const rpID = window.location.hostname;
  const origin = window.location.origin;

  const { data: optsData, error: optsErr } = await supabase.functions.invoke(
    "passkey-register-options",
    { body: { rpID, rpName: "Review Hub" } }
  );
  if (optsErr) throw new Error(await readInvokeError(optsErr, "Failed to get registration options"));
  if (optsData?.error) throw new Error(optsData.error);
  if (!optsData?.options) throw new Error("Failed to get registration options");

  const attResp = await startRegistration(optsData.options);

  const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
    "passkey-register-verify",
    { body: { response: attResp, rpID, origin, deviceLabel } }
  );
  if (verifyErr) throw new Error(await readInvokeError(verifyErr, "Verification failed"));
  if (verifyData?.error) throw new Error(verifyData.error);
  if (!verifyData?.ok) throw new Error("Verification failed");
}

export async function signInWithPasskey(email: string) {
  const rpID = window.location.hostname;
  const origin = window.location.origin;

  const { data: optsData, error: optsErr } = await supabase.functions.invoke(
    "passkey-auth-options",
    { body: { email, rpID } }
  );
  if (optsErr) throw new Error(await readInvokeError(optsErr, "Failed to get authentication options"));
  if (optsData?.error) throw new Error(optsData.error);
  if (!optsData?.options) throw new Error("Failed to get authentication options");

  const authResp = await startAuthentication(optsData.options);

  const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
    "passkey-auth-verify",
    { body: { response: authResp, rpID, origin } }
  );
  if (verifyErr) throw new Error(await readInvokeError(verifyErr, "Sign-in failed"));
  if (verifyData?.error) throw new Error(verifyData.error);
  if (!verifyData?.ok || !verifyData?.token_hash) {
    throw new Error("Sign-in failed");
  }

  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: verifyData.token_hash,
  });
  if (otpErr) throw otpErr;
}
