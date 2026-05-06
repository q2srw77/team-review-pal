import { createClient } from 'npm:@supabase/supabase-js@2'
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@10'

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
    const email = String(body?.email || '').trim().toLowerCase()
    const rpID = String(body?.rpID || '')
    if (!rpID) return json(400, { error: 'rpID required' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = []
    if (email) {
      const { data: profile } = await admin
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle()
      if (profile) {
        const { data: keys } = await admin
          .from('user_passkeys')
          .select('credential_id, transports')
          .eq('user_id', profile.user_id)
        allowCredentials = (keys ?? []).map((k) => ({
          id: k.credential_id,
          transports: (k.transports ?? []) as AuthenticatorTransport[],
        }))
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials,
    })

    console.log('auth-options', { email, rpID, allowCount: allowCredentials.length })

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    await admin.from('passkey_challenges').insert({
      email: email || null,
      challenge: options.challenge,
      type: 'authentication',
      expires_at: expiresAt,
    })

    return json(200, { options })
  } catch (e) {
    console.error('passkey-auth-options', e)
    return json(500, { error: (e as Error).message })
  }
})
