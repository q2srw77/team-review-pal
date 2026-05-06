import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ATTEMPTS = 5
const GENERIC_INVALID = 'This reset link is invalid or has expired.'

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Expected validation failures => HTTP 200 with { ok: false, error }
// so supabase.functions.invoke delivers the message in `data` instead of throwing.
function fail(error: string) {
  return json(200, { ok: false, error })
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

    if (!token || !/^\d{6}$/.test(code)) {
      console.log('confirm-password-reset: missing token or malformed code')
      return fail(GENERIC_INVALID)
    }
    const pwErr = validatePassword(newPassword)
    if (pwErr) return fail(pwErr)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const tokenHash = await sha256(token)
    const { data: row, error: lookupErr } = await admin
      .from('password_reset_tokens')
      .select('id, user_id, code_hash, expires_at, used_at, attempts')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (lookupErr) {
      console.error('confirm-password-reset: lookup error', lookupErr)
      return json(500, { ok: false, error: 'Server error. Please try again.' })
    }
    if (!row) {
      console.log('confirm-password-reset: token not found')
      return fail(GENERIC_INVALID)
    }
    if (row.used_at) {
      console.log('confirm-password-reset: token already used', row.id)
      return fail(GENERIC_INVALID)
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      console.log('confirm-password-reset: token expired', row.id)
      return fail(GENERIC_INVALID)
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      console.log('confirm-password-reset: token already locked', row.id)
      // Ensure it stays locked
      await admin.from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('used_at', null)
      return fail('Too many incorrect attempts. Please request a new reset link.')
    }

    const codeHash = await sha256(code)
    if (codeHash !== row.code_hash) {
      const newAttempts = row.attempts + 1
      const lock = newAttempts >= MAX_ATTEMPTS
      await admin
        .from('password_reset_tokens')
        .update({
          attempts: newAttempts,
          ...(lock ? { used_at: new Date().toISOString() } : {}),
        })
        .eq('id', row.id)
      console.log('confirm-password-reset: bad code', { id: row.id, newAttempts, lock })
      if (lock) return fail('Too many incorrect attempts. Please request a new reset link.')
      const remaining = MAX_ATTEMPTS - newAttempts
      return fail(`Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`)
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, { password: newPassword })
    if (updErr) {
      console.error('confirm-password-reset: updateUserById error', updErr)
      return json(500, { ok: false, error: 'Could not update password. Please try again.' })
    }

    const now = new Date().toISOString()
    await admin.from('password_reset_tokens').update({ used_at: now }).eq('id', row.id)
    await admin.from('password_reset_tokens').update({ used_at: now })
      .eq('user_id', row.user_id).is('used_at', null)

    console.log('confirm-password-reset: success', { user_id: row.user_id })
    return json(200, { ok: true })
  } catch (e) {
    console.error('confirm-password-reset: unexpected error', e)
    return json(500, { ok: false, error: 'Server error. Please try again.' })
  }
})
