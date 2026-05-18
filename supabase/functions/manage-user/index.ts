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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, user_id } = body;

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "action and user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_roles") {
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot modify your own roles" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { roles } = body;
      const validRoles = ["admin", "reviewer", "submitter"];
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return new Response(JSON.stringify({ error: "roles array is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!roles.every((r: string) => validRoles.includes(r))) {
        return new Response(JSON.stringify({ error: "Invalid role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("user_roles").delete().eq("user_id", user_id);
      await supabase.from("user_roles").insert(
        roles.map((r: string) => ({ user_id, role: r }))
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_user") {
      const { full_name, email, password } = body;

      // Update auth user (email, password)
      const authUpdate: Record<string, unknown> = {};
      if (email && typeof email === "string" && email.trim()) {
        authUpdate.email = email.trim();
      }
      if (password && typeof password === "string" && password.length >= 6) {
        authUpdate.password = password;
      }
      if (password && typeof password === "string" && password.length > 0 && password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (Object.keys(authUpdate).length > 0) {
        const { error: authError } = await supabase.auth.admin.updateUserById(user_id, authUpdate);
        if (authError) {
          return new Response(JSON.stringify({ error: authError.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update profile (full_name, email)
      const profileUpdate: Record<string, string> = {};
      if (full_name && typeof full_name === "string" && full_name.trim()) {
        profileUpdate.full_name = full_name.trim();
      }
      if (email && typeof email === "string" && email.trim()) {
        profileUpdate.email = email.trim();
      }

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("user_id", user_id);
        if (profileError) {
          return new Response(JSON.stringify({ error: profileError.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Collect requests where this user is currently a reviewer — these
      //    may need their status recomputed once their review_status row is gone.
      const { data: reviewerRows } = await supabase
        .from("review_statuses")
        .select("request_id")
        .eq("reviewer_id", user_id);
      const affectedRequestIds = Array.from(
        new Set((reviewerRows ?? []).map((r) => r.request_id as string)),
      );

      // 2. Remove all rows tied to the deleted user that would otherwise block
      //    review progress or render as "Unknown".
      await Promise.all([
        supabase.from("review_statuses").delete().eq("reviewer_id", user_id),
        supabase.from("review_reminders_sent").delete().eq("reviewer_id", user_id),
        supabase.from("request_notes").delete().eq("author_id", user_id),
        supabase.from("user_passkeys").delete().eq("user_id", user_id),
        supabase.from("user_settings").delete().eq("user_id", user_id),
        supabase.from("passkey_challenges").delete().eq("user_id", user_id),
      ]);

      // 3. Recompute status for each affected request (mirrors
      //    auto_update_request_status trigger; runs in TS because the trigger
      //    only fires on review_statuses insert/update, not delete).
      for (const requestId of affectedRequestIds) {
        const { data: req } = await supabase
          .from("review_requests")
          .select("status")
          .eq("id", requestId)
          .single();
        if (!req || (req.status !== "pending" && req.status !== "in_review")) continue;

        const { data: statuses } = await supabase
          .from("review_statuses")
          .select("status")
          .eq("request_id", requestId);
        const total = statuses?.length ?? 0;
        const completed = (statuses ?? []).filter((s) => s.status === "completed").length;
        const inReview = (statuses ?? []).filter((s) => s.status === "in_review").length;

        let newStatus: "pending" | "in_review" | "correction";
        if (total === 0) {
          // No remaining reviewers — unblock by moving to correction so the
          // submitter can act, matching the auto-close-overdue behavior.
          newStatus = "correction";
        } else if (completed === total) {
          newStatus = "correction";
        } else if (inReview > 0 || completed > 0) {
          newStatus = "in_review";
        } else {
          newStatus = "pending";
        }

        await supabase
          .from("review_requests")
          .update({ status: newStatus })
          .eq("id", requestId);
      }

      // 4. Existing cleanup + delete the auth user.
      await supabase.from("team_members").delete().eq("user_id", user_id);
      await supabase.from("user_roles").delete().eq("user_id", user_id);
      await supabase.from("profiles").delete().eq("user_id", user_id);

      // 5. Audit log.
      await supabase.from("audit_logs").insert({
        user_id: caller.id,
        user_name: caller.email ?? "Admin",
        action: "deleted_user_cleanup",
        entity_type: "user",
        entity_id: user_id,
        details: {
          affected_request_count: affectedRequestIds.length,
          affected_request_ids: affectedRequestIds,
        },
      });

      const { error } = await supabase.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
