import { createClient } from 'npm:@supabase/supabase-js@2'
import { generateRegistrationOptions } from 'npm:@simplewebauthn/server@11'
import { getRpID, RP_NAME } from '../_shared/webauthn-config.ts'

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
    console.log('register-options entry', { hasAuth: !!auth })
    if (!auth?.startsWith('Bearer ')) return json(401, { error: 'Missing Authorization header' })

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: userData, error: userErr } = await anon.auth.getUser()
    if (userErr || !userData?.user) {
      console.error('register-options auth failed', userErr)
      return json(401, { error: 'Session expired. Please sign in again and retry.' })
    }
    const userId = userData.user.id
    const email = userData.user.email ?? ''

    const body = await req.json().catch(() => ({}))
    const rpID = String(body?.rpID || '')
    const rpName = String(body?.rpName || 'Review Hub')
    if (!rpID) return json(400, { error: 'rpID required' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: existing } = await admin
      .from('user_passkeys')
      .select('credential_id, transports')
      .eq('user_id', userId)

    if ((existing?.length ?? 0) >= 3) {
      return json(400, { error: 'Passkey limit reached (3). Remove one to add another.' })
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: email || userId,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as AuthenticatorTransport[],
      })),
    })

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    await admin.from('passkey_challenges').insert({
      user_id: userId,
      email,
      challenge: options.challenge,
      type: 'registration',
      expires_at: expiresAt,
    })

    return json(200, { options })
  } catch (e) {
    console.error('passkey-register-options', e)
    return json(500, { error: (e as Error).message })
  }
})
