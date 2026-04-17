import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth gate: only the cron scheduler (service role) may invoke this function.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const token = authHeader.slice("Bearer ".length);
    const payloadB64 = token.split(".")[1];
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const claims = JSON.parse(
      atob(padded.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (claims?.role !== "service_role") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = createClient(supabaseUrl, serviceRoleKey);

    // Find overdue, not-yet-completed requests
    const today = new Date().toISOString().slice(0, 10);
    const { data: overdue, error: fetchErr } = await service
      .from("review_requests")
      .select("id, title, platform, team_id, submitted_by, complete_by, status, report_pdf_path")
      .neq("status", "completed")
      .not("complete_by", "is", null)
      .lt("complete_by", today);

    if (fetchErr) {
      console.error("fetch overdue error", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const r of overdue ?? []) {
      try {
        // Flip request to completed with deadline_reached reason
        const { error: updErr } = await service
          .from("review_requests")
          .update({ status: "completed", closed_reason: "deadline_reached" })
          .eq("id", r.id);
        if (updErr) throw updErr;

        // Lookup submitter email + team name for email payload
        const [{ data: submitter }, { data: team }, { data: statuses }] = await Promise.all([
          service.from("profiles").select("email, full_name").eq("user_id", r.submitted_by).single(),
          r.team_id
            ? service.from("teams").select("name").eq("id", r.team_id).single()
            : Promise.resolve({ data: null }),
          service.from("review_statuses").select("status").eq("request_id", r.id),
        ]);

        const total = statuses?.length ?? 0;
        const completed = (statuses ?? []).filter((s) => s.status === "completed").length;

        // Audit log
        await service.from("audit_logs").insert({
          user_id: r.submitted_by,
          user_name: "System (auto-close)",
          action: "auto_closed",
          entity_type: "review_request",
          entity_id: r.id,
          details: { reason: "deadline_reached", completed, total, complete_by: r.complete_by },
        });

        // Generate the PDF report (server-side; this function calls send-transactional-email for review-completed too)
        try {
          await fetch(`${supabaseUrl}/functions/v1/generate-review-report`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify({ request_id: r.id }),
          });
        } catch (e) {
          console.error("generate-review-report failed for", r.id, e);
        }

        // Send the "all complete" notification to submitter
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
                templateName: "review-all-complete",
                recipientEmail: submitter.email,
                idempotencyKey: `auto-close-${r.id}`,
                templateData: {
                  title: r.title,
                  platform: r.platform,
                  teamName: team?.name ?? null,
                  closedReason: "deadline_reached",
                  completedCount: completed,
                  totalCount: total,
                },
              }),
            });
          } catch (e) {
            console.error("send-transactional-email failed for", r.id, e);
          }
        }

        results.push({ id: r.id, ok: true });
      } catch (e) {
        console.error("auto-close failed for", r.id, e);
        results.push({ id: r.id, ok: false, error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("auto-close-overdue-requests error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
