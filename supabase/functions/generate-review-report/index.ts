import { createClient } from 'npm:@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@2.5.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Validate caller JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    let isServiceRole = false
    try {
      const payloadB64 = token.split('.')[1]
      const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4)
      const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
      isServiceRole = payload?.role === 'service_role'
    } catch { /* fall through */ }

    if (!isServiceRole) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { request_id } = await req.json()
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch request details
    const { data: request, error: reqErr } = await supabase
      .from('review_requests')
      .select('*')
      .eq('id', request_id)
      .single()

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Skip if already generated
    if (request.report_pdf_path) {
      return new Response(JSON.stringify({ success: true, message: 'Report already generated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch submitter profile
    const { data: submitter } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', request.submitted_by)
      .single()

    // Fetch team name
    let teamName = 'N/A'
    if (request.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', request.team_id)
        .single()
      teamName = team?.name ?? 'N/A'
    }

    // Fetch reviewer statuses with names
    const { data: reviewStatuses } = await supabase
      .from('review_statuses')
      .select('reviewer_id, status')
      .eq('request_id', request_id)

    const reviewerIds = reviewStatuses?.map((r: any) => r.reviewer_id) ?? []
    let reviewerNames = new Map<string, string>()
    if (reviewerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', reviewerIds)
      profiles?.forEach((p: any) => reviewerNames.set(p.user_id, p.full_name))
    }

    // Fetch platform position label
    let positionLabel = 'None'
    if (request.platform) {
      const { data: platformRow } = await supabase
        .from('platforms')
        .select('position_label')
        .eq('name', request.platform)
        .maybeSingle()
      positionLabel = (platformRow as { position_label?: string } | null)?.position_label ?? 'None'
    }

    // Fetch reviewer notes
    const { data: notesRaw } = await supabase
      .from('request_notes')
      .select('content, created_at, author_id, position_number')
      .eq('request_id', request_id)
      .order('created_at', { ascending: true })

    const notes = positionLabel !== 'None'
      ? [...(notesRaw ?? [])].sort((a: any, b: any) => {
          const ax = a.position_number ?? Number.MAX_SAFE_INTEGER
          const bx = b.position_number ?? Number.MAX_SAFE_INTEGER
          if (ax !== bx) return ax - bx
          return String(a.created_at).localeCompare(String(b.created_at))
        })
      : (notesRaw ?? [])

    const noteAuthorIds = [...new Set(notes?.map((n: any) => n.author_id) ?? [])]
    let noteAuthorNames = new Map<string, string>()
    if (noteAuthorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', noteAuthorIds)
      profiles?.forEach((p: any) => noteAuthorNames.set(p.user_id, p.full_name))
    }

    // Generate PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let y = 20

    const checkPage = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage()
        y = 20
      }
    }

    // Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Review Report', margin, y)
    y += 12

    // Request title
    doc.setFontSize(14)
    doc.text(request.title, margin, y)
    y += 10

    // Divider
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Details section
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const details = [
      ['Platform', request.platform],
      ['Team', teamName],
      ['Submitted By', submitter?.full_name ?? 'Unknown'],
      ['Submitted', new Date(request.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      ['Complete By', request.complete_by ? new Date(request.complete_by).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'],
      ['Status', request.status.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())],
      ['URL', request.url_location || 'N/A'],
    ]

    for (const [label, value] of details) {
      checkPage(6)
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, margin, y)
      doc.setFont('helvetica', 'normal')
      const valText = doc.splitTextToSize(String(value), contentWidth - 35)
      doc.text(valText, margin + 35, y)
      y += valText.length * 5 + 2
    }

    // Submitter notes
    if (request.notes) {
      y += 4
      checkPage(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Request Notes:', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      const noteLines = doc.splitTextToSize(request.notes, contentWidth)
      for (const line of noteLines) {
        checkPage(6)
        doc.text(line, margin, y)
        y += 5
      }
    }

    // Reviewer Progress
    y += 8
    checkPage(12)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Reviewer Progress', margin, y)
    y += 8

    doc.setFontSize(10)
    if (reviewStatuses && reviewStatuses.length > 0) {
      for (const rs of reviewStatuses) {
        checkPage(6)
        const name = reviewerNames.get(rs.reviewer_id) ?? 'Unknown'
        const statusLabel = rs.status.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        doc.setFont('helvetica', 'normal')
        doc.text(`${name}: ${statusLabel}`, margin + 4, y)
        y += 6
      }
    } else {
      doc.setFont('helvetica', 'normal')
      doc.text('No reviewers assigned.', margin + 4, y)
      y += 6
    }

    // Reviewer Comments
    y += 8
    checkPage(12)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Reviewer Comments', margin, y)
    y += 8

    doc.setFontSize(10)
    if (notes && notes.length > 0) {
      for (const note of notes) {
        checkPage(22)
        const authorName = noteAuthorNames.get(note.author_id) ?? 'Unknown'
        const date = new Date(note.created_at).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })

        // Render position badge (Slide/Step/Page) when applicable
        if (positionLabel !== 'None' && note.position_number != null) {
          const badgeText = `${positionLabel.toUpperCase()} ${note.position_number}`
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          const textW = doc.getTextWidth(badgeText)
          const padX = 2.5
          const badgeW = textW + padX * 2
          const badgeH = 5
          doc.setFillColor(32, 6, 247)
          doc.roundedRect(margin + 4, y - 4, badgeW, badgeH, 1.2, 1.2, 'F')
          doc.setTextColor(255, 255, 255)
          doc.text(badgeText, margin + 4 + padX, y - 0.3)
          // reset
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(10)
          y += 4
        }

        doc.setFont('helvetica', 'bold')
        doc.text(`${authorName} — ${date}`, margin + 4, y)
        y += 5

        doc.setFont('helvetica', 'normal')
        const commentLines = doc.splitTextToSize(note.content, contentWidth - 8)
        for (const line of commentLines) {
          checkPage(6)
          doc.text(line, margin + 4, y)
          y += 5
        }
        y += 4
      }
    } else {
      doc.setFont('helvetica', 'normal')
      doc.text('No reviewer comments.', margin + 4, y)
    }

    // Convert to Uint8Array
    const pdfOutput = doc.output('arraybuffer')
    const pdfBytes = new Uint8Array(pdfOutput)

    // Upload to storage
    const fileName = `${request_id}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('review-reports')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      return new Response(JSON.stringify({ error: 'Failed to upload PDF' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update review_requests with the path
    await supabase
      .from('review_requests')
      .update({ report_pdf_path: fileName })
      .eq('id', request_id)

    // Get signed URL for the PDF (1 hour expiry)
    const { data: urlData } = await supabase.storage
      .from('review-reports')
      .createSignedUrl(fileName, 3600)

    // Send email to submitter
    if (submitter?.email) {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'review-completed',
          recipientEmail: submitter.email,
          idempotencyKey: `review-completed-${request_id}`,
          templateData: {
            title: request.title,
            platform: request.platform,
            teamName,
            downloadUrl: urlData?.signedUrl ?? '',
          },
        },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error generating report:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
