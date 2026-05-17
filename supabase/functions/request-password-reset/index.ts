import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

const GENERIC = { ok: true }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Generic response to avoid enumeration
      return new Response(JSON.stringify(GENERIC), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    // Find user by email via profiles (avoids paginating auth.users)
    const { data: profile } = await admin
      .from('profiles').select('user_id, full_name, email').eq('email', email).maybeSingle()

    if (!profile?.user_id) {
      return new Response(JSON.stringify(GENERIC), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit: max 3 tokens in last 15 minutes
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('password_reset_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.user_id)
      .gte('created_at', since)

    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify(GENERIC), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Invalidate prior unused tokens
    await admin.from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', profile.user_id)
      .is('used_at', null)

    const linkToken = generateToken()
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    const { error: insertErr } = await admin.from('password_reset_tokens').insert({
      user_id: profile.user_id,
      token_hash: await sha256(linkToken),
      code_hash: await sha256(code),
      expires_at: expiresAt,
    })
    if (insertErr) {
      console.error('insert token error', insertErr)
      return new Response(JSON.stringify(GENERIC), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const envOrigin = Deno.env.get('APP_ORIGIN')
    const origin = envOrigin && /^https?:\/\//.test(envOrigin) ? envOrigin.replace(/\/$/, '') : 'https://reviewhub.cyphersecurity.us'
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(linkToken)}`

    // Send via shared transactional email function
    const sendRes = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'password-reset',
        recipientEmail: email,
        idempotencyKey: `pwd-reset-${linkToken.slice(0, 16)}`,
        templateData: { resetUrl, code },
      },
    })
    if (sendRes.error) console.error('send email error', sendRes.error)

    return new Response(JSON.stringify(GENERIC), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('request-password-reset error', e)
    return new Response(JSON.stringify(GENERIC), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
