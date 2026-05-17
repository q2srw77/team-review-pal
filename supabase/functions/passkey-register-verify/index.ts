import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyRegistrationResponse } from 'npm:@simplewebauthn/server@11'
import { getAllowedRpIDs, getExpectedOrigins } from '../_shared/webauthn-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization')
    console.log('register-verify entry', { hasAuth: !!auth })
    if (!auth?.startsWith('Bearer ')) return json(401, { error: 'Missing Authorization header' })

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: userData, error: userErr } = await anon.auth.getUser()
    if (userErr || !userData?.user) {
      console.error('register-verify auth failed', userErr)
      return json(401, { error: 'Session expired. Please sign in again and retry.' })
    }
    const userId = userData.user.id

    const body = await req.json().catch(() => ({}))
    const response = body?.response
    const deviceLabel = String(body?.deviceLabel || 'Passkey').slice(0, 80)
    if (!response) return json(400, { error: 'Missing fields' })

    // rpID/origin are server-enforced — never read from client body.
    const allowedRpIDs = getAllowedRpIDs()
    const allowedOrigins = getExpectedOrigins()
    const rpID = allowedRpIDs[0]

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const expectedChallenge = response?.response?.clientDataJSON
      ? JSON.parse(atob(response.response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))).challenge
      : null
    if (!expectedChallenge) return json(400, { error: 'Bad clientDataJSON' })

    console.log('register-verify start', { userId, rpID, origin, hasResponse: !!response })

    const { data: ch } = await admin
      .from('passkey_challenges')
      .select('id, expires_at, used_at')
      .eq('challenge', expectedChallenge)
      .eq('type', 'registration')
      .eq('user_id', userId)
      .maybeSingle()

    console.log('register-verify challenge', { found: !!ch, used: !!ch?.used_at, expired: ch ? new Date(ch.expires_at).getTime() < Date.now() : null })

    if (!ch || ch.used_at || new Date(ch.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'Challenge invalid or expired' })
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    console.log('register-verify webauthn', { verified: verification.verified, hasInfo: !!verification.registrationInfo })

    if (!verification.verified || !verification.registrationInfo) {
      return json(400, { error: 'Verification failed' })
    }

    const { credential } = verification.registrationInfo
    const transports = (response?.response?.transports ?? []) as string[]

    // Count existing passkeys BEFORE inserting to know if this is the first
    const { count: existingCount } = await admin
      .from('user_passkeys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if ((existingCount ?? 0) >= 3) {
      return json(400, { error: 'You already have the maximum of 3 passkeys. Remove one before adding another.' })
    }

    const { data: inserted, error: insErr } = await admin
      .from('user_passkeys')
      .insert({
        user_id: userId,
        credential_id: credential.id,
        public_key: btoa(String.fromCharCode(...credential.publicKey)),
        counter: credential.counter ?? 0,
        transports,
        device_label: deviceLabel,
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      console.error('insert passkey failed', insErr)
      return json(500, { error: 'Could not save passkey' })
    }

    // First passkey → rotate Supabase password to a random value so password
    // sign-in is enforced at the auth layer, not just the UI.
    if ((existingCount ?? 0) === 0) {
      const randomBytes = crypto.getRandomValues(new Uint8Array(48))
      const randomPassword = btoa(String.fromCharCode(...randomBytes)) + 'Aa1!'
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
        password: randomPassword,
      })
      if (pwErr) {
        // Roll back the inserted passkey so the user isn't locked out
        // with a passkey-only state we couldn't actually enforce.
        console.error('password rotation failed, rolling back passkey', pwErr)
        await admin.from('user_passkeys').delete().eq('id', inserted.id)
        return json(500, { error: 'Could not enforce passkey-only sign-in. Please try again.' })
      }
      console.log('passkey-register-verify: first passkey, rotated password', { userId })
    } else {
      console.log('passkey-register-verify: additional passkey, skipping rotation', { userId })
    }

    await admin.from('passkey_challenges').update({ used_at: new Date().toISOString() }).eq('id', ch.id)

    // Disable password sign-in for this account (UI hint)
    await admin.from('profiles').update({ password_disabled: true }).eq('user_id', userId)

    return json(200, { ok: true })
  } catch (e) {
    console.error('passkey-register-verify', e)
    return json(500, { error: (e as Error).message })
  }
})
