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
      .select("id, title, submitted_by, status, current_round, team_id, platform")
      .eq("id", request_id)
      .single();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (request.submitted_by !== userId) {
      return new Response(JSON.stringify({ error: "Only the submitter can resubmit" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (request.status !== "correction") {
      return new Response(JSON.stringify({ error: "Request must be in correction" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentRound = request.current_round ?? 1;

    // Count rejected for audit
    const { data: currentNotes } = await service
      .from("request_notes")
      .select("decision")
      .eq("request_id", request_id)
      .eq("round_number", currentRound)
      .eq("archived", false);
    const rejectedCount = (currentNotes ?? []).filter((n: any) => n.decision === "rejected").length;

    // Archive current round
    const { error: archErr } = await service
      .from("request_notes")
      .update({ archived: true })
      .eq("request_id", request_id)
      .eq("round_number", currentRound);
    if (archErr) throw archErr;

    const newRound = currentRound + 1;

    // Bump round + reset status to pending; the trigger will re-evaluate when statuses change
    const { error: bumpErr } = await service
      .from("review_requests")
      .update({ current_round: newRound, status: "pending" })
      .eq("id", request_id);
    if (bumpErr) throw bumpErr;

    // Reset reviewer statuses to pending
    const { data: statuses } = await service
      .from("review_statuses")
      .select("id, reviewer_id")
      .eq("request_id", request_id);

    if (statuses && statuses.length > 0) {
      const { error: rsErr } = await service
        .from("review_statuses")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("request_id", request_id);
      if (rsErr) throw rsErr;
    }

    // Audit log
    await service.from("audit_logs").insert({
      user_id: userId,
      user_name: (await service.from("profiles").select("full_name").eq("user_id", userId).single()).data?.full_name ?? "",
      action: "resubmitted_for_review",
      entity_type: "review_request",
      entity_id: request_id,
      details: { from_round: currentRound, to_round: newRound, rejected_count: rejectedCount },
    });

    // Email each reviewer
    const reviewerIds = (statuses ?? []).map((s: any) => s.reviewer_id);
    if (reviewerIds.length > 0) {
      const { data: profiles } = await service
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", reviewerIds);
      const requestUrl = `${supabaseUrl.replace(/\/+$/, "")}`.replace(/\.supabase\.co$/, "") + "/dashboard";
      for (const p of profiles ?? []) {
        if (!p.email) continue;
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify({
              templateName: "review-resubmitted",
              recipientEmail: p.email,
              idempotencyKey: `review-resubmitted-${request_id}-r${newRound}-${p.user_id}`,
              templateData: {
                title: request.title,
                round: newRound,
                reviewerName: p.full_name,
                requestUrl,
              },
            }),
          });
        } catch (e) {
          console.error("send resubmit email failed", p.user_id, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, round: newRound }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resubmit-for-review error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
