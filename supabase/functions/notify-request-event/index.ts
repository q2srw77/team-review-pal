// Server-side wrapper for triggering request-related transactional emails.
// Replaces direct client calls to send-transactional-email so that:
//   1. send-transactional-email can remain admin/service-role only
//   2. emails for a given request can only be triggered by users with a
//      legitimate relationship to that request (submitter or team member).
//
// verify_jwt = false in config.toml — JWT validated in code below.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type EventName = 'request_created' | 'all_reviews_complete'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claimsData.claims.sub as string

    let body: { event?: EventName; request_id?: string }
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { event, request_id } = body

    // Build the link server-side from a trusted env var. Never accept the
    // app URL from the client — that would let any submitter inject arbitrary
    // (e.g. phishing) URLs into emails sent via our legitimate domain.
    const envOrigin = Deno.env.get('APP_ORIGIN')
    const app_url = envOrigin && /^https?:\/\//.test(envOrigin)
      ? envOrigin.replace(/\/$/, '')
      : 'https://reviewhub.cyphersecurity.us'
    if (!event || !request_id) {
      return new Response(JSON.stringify({ error: 'event and request_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: request, error: reqErr } = await admin
      .from('review_requests')
      .select('id, title, platform, team_id, submitted_by')
      .eq('id', request_id)
      .single()
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authorization: caller must be submitter, team member, or admin.
    let allowed = request.submitted_by === userId
    if (!allowed) {
      const { data: isAdmin } = await admin.rpc('has_role', {
        _user_id: userId, _role: 'admin',
      })
      allowed = !!isAdmin
    }
    if (!allowed && request.team_id) {
      const { data: isMember } = await admin.rpc('is_team_member', {
        _user_id: userId, _team_id: request.team_id,
      })
      allowed = !!isMember
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let teamName: string | undefined
    if (request.team_id) {
      const { data: team } = await admin
        .from('teams').select('name').eq('id', request.team_id).maybeSingle()
      teamName = team?.name ?? undefined
    }

    const invokeEmail = async (payload: Record<string, unknown>) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('send-transactional-email failed', res.status, text)
      }
    }

    if (event === 'request_created') {
      // Only the submitter of this request may trigger this.
      if (request.submitted_by !== userId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!request.team_id) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: members } = await admin
        .from('team_members').select('user_id').eq('team_id', request.team_id)
      const otherIds = (members ?? [])
        .map((m: any) => m.user_id)
        .filter((id: string) => id !== userId)
      if (otherIds.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: profiles } = await admin
        .from('profiles').select('user_id, email, full_name').in('user_id', otherIds)
      const { data: submitterProfile } = await admin
        .from('profiles').select('full_name').eq('user_id', userId).maybeSingle()

      const { data: requestFull } = await admin
        .from('review_requests').select('complete_by').eq('id', request_id).maybeSingle()

      let sent = 0
      for (const p of profiles ?? []) {
        if (!p.email) continue
        await invokeEmail({
          templateName: 'new-review-request',
          recipientEmail: p.email,
          idempotencyKey: `review-notify-${request_id}-${p.user_id}`,
          templateData: {
            title: request.title,
            platform: request.platform,
            teamName,
            submitterName: submitterProfile?.full_name ?? '',
            completeBy: requestFull?.complete_by ?? undefined,
            appUrl: app_url ?? '',
          },
        })
        sent++
      }
      return new Response(JSON.stringify({ success: true, sent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (event === 'all_reviews_complete') {
      // Verify, server-side, that all reviewers have actually completed.
      const { data: statuses } = await admin
        .from('review_statuses').select('status').eq('request_id', request_id)
      const allDone = statuses && statuses.length > 0 &&
        statuses.every((s: any) => s.status === 'completed')
      if (!allDone) {
        return new Response(JSON.stringify({ success: true, skipped: 'not_all_complete' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: submitterProfile } = await admin
        .from('profiles').select('email').eq('user_id', request.submitted_by).maybeSingle()
      if (!submitterProfile?.email) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      await invokeEmail({
        templateName: 'review-all-complete',
        recipientEmail: submitterProfile.email,
        idempotencyKey: `review-all-complete-${request_id}`,
        templateData: {
          title: request.title,
          platform: request.platform,
          teamName,
        },
      })
      return new Response(JSON.stringify({ success: true, sent: 1 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown event' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-request-event error', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
