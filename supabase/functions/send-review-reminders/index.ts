import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function addDaysUTC(daysToAdd: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = createClient(supabaseUrl, serviceRoleKey);

    const summary: Array<{
      days_before: number;
      target_date: string;
      requests: number;
      reminders_sent: number;
      skipped_already_sent: number;
      errors: number;
    }> = [];

    for (const daysBefore of [2, 1]) {
      const targetDate = addDaysUTC(daysBefore);

      const { data: requests, error: reqErr } = await service
        .from("review_requests")
        .select("id, title, platform, team_id, submitted_by, complete_by, status")
        .neq("status", "completed")
        .eq("complete_by", targetDate);

      if (reqErr) {
        console.error("fetch requests error", { daysBefore, targetDate, reqErr });
        summary.push({
          days_before: daysBefore,
          target_date: targetDate,
          requests: 0,
          reminders_sent: 0,
          skipped_already_sent: 0,
          errors: 1,
        });
        continue;
      }

      let remindersSent = 0;
      let skipped = 0;
      let errors = 0;

      for (const r of requests ?? []) {
        try {
          // Outstanding reviewers for this request
          const { data: statuses, error: stErr } = await service
            .from("review_statuses")
            .select("reviewer_id, status")
            .eq("request_id", r.id)
            .in("status", ["pending", "in_review"]);
          if (stErr) throw stErr;

          if (!statuses || statuses.length === 0) continue;

          // Submitter + team for template context
          const [{ data: submitter }, teamRes] = await Promise.all([
            service
              .from("profiles")
              .select("full_name")
              .eq("user_id", r.submitted_by)
              .maybeSingle(),
            r.team_id
              ? service.from("teams").select("name").eq("id", r.team_id).maybeSingle()
              : Promise.resolve({ data: null as { name: string } | null }),
          ]);

          // Fetch reviewer profiles in one shot
          const reviewerIds = statuses.map((s) => s.reviewer_id);
          const { data: profiles, error: profErr } = await service
            .from("profiles")
            .select("user_id, email, full_name")
            .in("user_id", reviewerIds);
          if (profErr) throw profErr;

          const profileMap = new Map(
            (profiles ?? []).map((p) => [p.user_id, p]),
          );

          for (const s of statuses) {
            const reviewer = profileMap.get(s.reviewer_id);
            if (!reviewer?.email) {
              continue;
            }

            // Idempotency guard: insert tracker row, ignore on conflict.
            const { data: inserted, error: insErr } = await service
              .from("review_reminders_sent")
              .insert({
                request_id: r.id,
                reviewer_id: s.reviewer_id,
                days_before: daysBefore,
              })
              .select("id");

            if (insErr) {
              // Unique violation = already sent. Treat as skip.
              if ((insErr as any).code === "23505") {
                skipped++;
                continue;
              }
              throw insErr;
            }

            if (!inserted || inserted.length === 0) {
              skipped++;
              continue;
            }

            try {
              const resp = await fetch(
                `${supabaseUrl}/functions/v1/send-transactional-email`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceRoleKey}`,
                    apikey: anonKey,
                  },
                  body: JSON.stringify({
                    templateName: "review-reminder",
                    recipientEmail: reviewer.email,
                    idempotencyKey: `reminder-${r.id}-${s.reviewer_id}-${daysBefore}`,
                    templateData: {
                      title: r.title,
                      platform: r.platform,
                      teamName: teamRes?.data?.name ?? null,
                      daysRemaining: daysBefore,
                      completeBy: r.complete_by,
                      submitterName: submitter?.full_name ?? null,
                    },
                  }),
                },
              );
              if (!resp.ok) {
                const txt = await resp.text();
                console.error("send-transactional-email failed", {
                  request_id: r.id,
                  reviewer_id: s.reviewer_id,
                  status: resp.status,
                  body: txt,
                });
                errors++;
              } else {
                remindersSent++;
              }
            } catch (e) {
              console.error("send-transactional-email threw", e);
              errors++;
            }
          }
        } catch (e) {
          console.error("reminder loop error for request", r.id, e);
          errors++;
        }
      }

      summary.push({
        days_before: daysBefore,
        target_date: targetDate,
        requests: requests?.length ?? 0,
        reminders_sent: remindersSent,
        skipped_already_sent: skipped,
        errors,
      });
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-review-reminders error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
