import { createClient } from 'npm:@supabase/supabase-js@2'
import { generateRegistrationOptions } from 'npm:@simplewebauthn/server@10'

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
    if (!auth?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' })

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(auth.replace('Bearer ', ''))
    if (claimsErr || !claims?.claims) return json(401, { error: 'Unauthorized' })

    const userId = claims.claims.sub as string
    const email = (claims.claims.email as string) ?? ''

    const body = await req.json().catch(() => ({}))
    const rpID = String(body?.rpID || '')
    const rpName = String(body?.rpName || 'Review Hub')
    if (!rpID) return json(400, { error: 'rpID required' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: existing } = await admin
      .from('user_passkeys')
      .select('credential_id, transports')
      .eq('user_id', userId)

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
