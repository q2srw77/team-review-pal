import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10'

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
    const body = await req.json().catch(() => ({}))
    const response = body?.response
    const rpID = String(body?.rpID || '')
    const origin = String(body?.origin || '')
    if (!response || !rpID || !origin) return json(400, { error: 'Missing fields' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const credentialId = String(response?.id || '')
    console.log('auth-verify start', { rpID, origin, hasResponse: !!response, credentialId })

    const expectedChallenge = response?.response?.clientDataJSON
      ? JSON.parse(atob(response.response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))).challenge
      : null
    if (!expectedChallenge) return json(400, { error: 'Bad clientDataJSON' })

    const { data: ch } = await admin
      .from('passkey_challenges')
      .select('id, expires_at, used_at')
      .eq('challenge', expectedChallenge)
      .eq('type', 'authentication')
      .maybeSingle()

    console.log('auth-verify challenge', { found: !!ch, used: !!ch?.used_at, expired: ch ? new Date(ch.expires_at).getTime() < Date.now() : null })

    if (!ch || ch.used_at || new Date(ch.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'Challenge invalid or expired' })
    }

    const { data: key } = await admin
      .from('user_passkeys')
      .select('id, user_id, public_key, counter, transports')
      .eq('credential_id', credentialId)
      .maybeSingle()

    console.log('auth-verify credential lookup', { found: !!key, userId: key?.user_id })

    if (!key) return json(400, { error: 'Unknown passkey' })

    const publicKeyBytes = Uint8Array.from(atob(key.public_key), (c) => c.charCodeAt(0))

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialId,
        publicKey: publicKeyBytes,
        counter: Number(key.counter ?? 0),
        transports: (key.transports ?? []) as AuthenticatorTransport[],
      },
    })

    console.log('auth-verify webauthn', { verified: verification.verified, newCounter: verification.authenticationInfo?.newCounter })

    if (!verification.verified) return json(400, { error: 'Verification failed' })

    await admin
      .from('user_passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', key.id)
    await admin.from('passkey_challenges').update({ used_at: new Date().toISOString() }).eq('id', ch.id)

    // Mint a session: generate a magic link, return token_hash for client to verifyOtp
    const { data: user } = await admin.auth.admin.getUserById(key.user_id)
    const email = user?.user?.email
    if (!email) return json(500, { error: 'No email for user' })

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !link?.properties) {
      console.error('generateLink failed', linkErr)
      return json(500, { error: 'Could not create session' })
    }

    return json(200, {
      ok: true,
      email,
      token_hash: link.properties.hashed_token,
    })
  } catch (e) {
    console.error('passkey-auth-verify', e)
    return json(500, { error: (e as Error).message })
  }
})
