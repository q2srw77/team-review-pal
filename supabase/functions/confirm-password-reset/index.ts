import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function validatePassword(p: string): string | null {
  if (typeof p !== 'string' || p.length < 8 || p.length > 128) return 'Password must be 8-128 characters'
  if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p)) return 'Password must contain upper, lower, and a number'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!token || !/^\d{6}$/.test(code)) return err(400, 'Invalid or expired reset request')
    const pwErr = validatePassword(newPassword)
    if (pwErr) return err(400, pwErr)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const tokenHash = await sha256(token)
    const { data: row } = await admin
      .from('password_reset_tokens')
      .select('id, user_id, code_hash, expires_at, used_at, attempts')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!row) return err(400, 'Invalid or expired reset request')
    if (row.used_at) return err(400, 'Invalid or expired reset request')
    if (new Date(row.expires_at).getTime() < Date.now()) return err(400, 'Invalid or expired reset request')
    if (row.attempts >= 5) {
      await admin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id)
      return err(400, 'Invalid or expired reset request')
    }

    const codeHash = await sha256(code)
    if (codeHash !== row.code_hash) {
      await admin.from('password_reset_tokens').update({ attempts: row.attempts + 1 }).eq('id', row.id)
      return err(400, 'Invalid verification code')
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, { password: newPassword })
    if (updErr) {
      console.error('updateUserById error', updErr)
      return err(500, 'Could not update password')
    }

    // Mark this token used + invalidate all other unused tokens for the user
    const now = new Date().toISOString()
    await admin.from('password_reset_tokens').update({ used_at: now }).eq('id', row.id)
    await admin.from('password_reset_tokens').update({ used_at: now })
      .eq('user_id', row.user_id).is('used_at', null)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('confirm-password-reset error', e)
    return err(500, 'Server error')
  }
})
