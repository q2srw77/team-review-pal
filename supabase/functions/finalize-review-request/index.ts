import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { request_id } = await req.json();
    if (!request_id || typeof request_id !== "string") {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, serviceRoleKey);

    const { data: request, error: reqErr } = await service
      .from("review_requests")
      .select("id, title, submitted_by, status, current_round, team_id, platform, report_pdf_path")
      .eq("id", request_id)
      .single();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (request.submitted_by !== userId) {
      return new Response(JSON.stringify({ error: "Only the submitter can finalize" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (request.status !== "correction") {
      return new Response(JSON.stringify({ error: "Request must be in correction" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentRound = request.current_round ?? 1;

    // Verify no pending decisions in current (non-archived) round
    const { data: pendingNotes } = await service
      .from("request_notes")
      .select("id, decision")
      .eq("request_id", request_id)
      .eq("archived", false);

    const pending = (pendingNotes ?? []).filter((n: any) => n.decision === "pending");
    if (pending.length > 0) {
      return new Response(JSON.stringify({ error: `${pending.length} comment(s) still pending a decision` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acceptedCount = (pendingNotes ?? []).filter((n: any) => n.decision === "accepted").length;
    const rejectedCount = (pendingNotes ?? []).filter((n: any) => n.decision === "rejected").length;

    // Mark completed
    const { error: updErr } = await service
      .from("review_requests")
      .update({ status: "completed", closed_reason: "submitter_finalized" })
      .eq("id", request_id);
    if (updErr) throw updErr;

    // Audit log
    await service.from("audit_logs").insert({
      user_id: userId,
      user_name: (await service.from("profiles").select("full_name").eq("user_id", userId).single()).data?.full_name ?? "",
      action: "finalized_by_submitter",
      entity_type: "review_request",
      entity_id: request_id,
      details: { round_count: currentRound, accepted_count: acceptedCount, rejected_count: rejectedCount },
    });

    // Generate PDF (allow already-generated to be replaced by clearing the path first)
    if (request.report_pdf_path) {
      await service.from("review_requests").update({ report_pdf_path: null }).eq("id", request_id);
    }
    try {
      await fetch(`${supabaseUrl}/functions/v1/generate-review-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ request_id, skip_email: true }),
      });
    } catch (e) {
      console.error("generate-review-report failed", e);
    }

    // Get fresh report path + signed URL
    const { data: refreshed } = await service
      .from("review_requests")
      .select("report_pdf_path")
      .eq("id", request_id)
      .single();

    let downloadUrl = "";
    if (refreshed?.report_pdf_path) {
      const { data: urlData } = await service.storage
        .from("review-reports")
        .createSignedUrl(refreshed.report_pdf_path, 60 * 60 * 24 * 7); // 7 days
      downloadUrl = urlData?.signedUrl ?? "";
    }

    // Send email to submitter
    const [{ data: submitter }, { data: team }] = await Promise.all([
      service.from("profiles").select("email, full_name").eq("user_id", userId).single(),
      request.team_id
        ? service.from("teams").select("name").eq("id", request.team_id).single()
        : Promise.resolve({ data: null }),
    ]);

    if (submitter?.email) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            templateName: "review-finalized",
            recipientEmail: submitter.email,
            idempotencyKey: `review-finalized-${request_id}`,
            templateData: {
              title: request.title,
              platform: request.platform,
              teamName: team?.name ?? null,
              roundCount: currentRound,
              acceptedCount,
              rejectedCount,
              totalNotes: acceptedCount + rejectedCount,
              downloadUrl,
            },
          }),
        });
      } catch (e) {
        console.error("send finalize email failed", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("finalize-review-request error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
