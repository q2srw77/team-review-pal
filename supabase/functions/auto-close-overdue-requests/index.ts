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
    const service = createClient(supabaseUrl, serviceRoleKey);

    // Only target pending / in_review requests. Correction is the submitter's
    // responsibility; completed is already finished.
    const today = new Date().toISOString().slice(0, 10);
    const { data: overdue, error: fetchErr } = await service
      .from("review_requests")
      .select("id, title, platform, team_id, submitted_by, complete_by, status")
      .in("status", ["pending", "in_review"])
      .not("complete_by", "is", null)
      .lte("complete_by", today);

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
        // Force any non-completed reviewer rows to completed. The
        // auto_update_request_status trigger then flips the request to
        // 'correction' (since all reviewers are now completed).
        const { data: forced, error: forceErr } = await service
          .from("review_statuses")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("request_id", r.id)
          .neq("status", "completed")
          .select("id");
        if (forceErr) throw forceErr;
        const forcedCount = forced?.length ?? 0;

        // Stamp the deadline reason and ensure status is correction (safety
        // net for requests with zero reviewer rows where the trigger never
        // fires).
        const { error: updErr } = await service
          .from("review_requests")
          .update({ status: "correction", closed_reason: "deadline_reached" })
          .eq("id", r.id);
        if (updErr) throw updErr;

        // Counts for audit + email.
        const { data: statuses } = await service
          .from("review_statuses")
          .select("status")
          .eq("request_id", r.id);
        const total = statuses?.length ?? 0;
        const completed = (statuses ?? []).filter((s) => s.status === "completed").length;
        const naturallyCompleted = Math.max(0, completed - forcedCount);

        // Lookup submitter email + team name for email payload
        const [{ data: submitter }, { data: team }] = await Promise.all([
          service.from("profiles").select("email, full_name").eq("user_id", r.submitted_by).single(),
          r.team_id
            ? service.from("teams").select("name").eq("id", r.team_id).single()
            : Promise.resolve({ data: null }),
        ]);

        // Audit log
        await service.from("audit_logs").insert({
          user_id: r.submitted_by,
          user_name: "System (auto-advance)",
          action: "auto_advanced_to_correction",
          entity_type: "review_request",
          entity_id: r.id,
          details: {
            reason: "deadline_reached",
            forced_completed_reviewers: forcedCount,
            naturally_completed: naturallyCompleted,
            total,
            complete_by: r.complete_by,
          },
        });

        // Notify submitter — their turn to act.
        if (submitter?.email) {
          try {
            const { error: emailErr } = await service.functions.invoke(
              "send-transactional-email",
              {
                body: {
                  templateName: "review-auto-advanced-to-correction",
                  recipientEmail: submitter.email,
                  idempotencyKey: `auto-advance-${r.id}`,
                  templateData: {
                    title: r.title,
                    platform: r.platform,
                    teamName: team?.name ?? null,
                    completedCount: naturallyCompleted,
                    totalCount: total,
                    completeBy: r.complete_by,
                  },
                },
              },
            );
            if (emailErr) console.error("send-transactional-email failed for", r.id, emailErr);
          } catch (e) {
            console.error("send-transactional-email threw for", r.id, e);
          }
        }

        results.push({ id: r.id, ok: true });
      } catch (e) {
        console.error("auto-advance failed for", r.id, e);
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
