import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ACTIONS = ["created", "updated", "archived", "deleted", "review_status_changed", "correction_decision_made", "resubmitted_for_review", "finalized_by_submitter"];
const VALID_ENTITY_TYPES = ["review_request"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate caller JWT
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { action, entity_type, entity_id, details } = body;

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate entity_type
    if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)) {
      return new Response(JSON.stringify({ error: "Invalid entity_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate entity_id is a UUID if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (entity_id && !uuidRegex.test(entity_id)) {
      return new Response(JSON.stringify({ error: "Invalid entity_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate details is an object if provided, and limit size
    if (details !== undefined && details !== null) {
      if (typeof details !== "object" || Array.isArray(details)) {
        return new Response(JSON.stringify({ error: "Invalid details" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const detailsStr = JSON.stringify(details);
      if (detailsStr.length > 5000) {
        return new Response(JSON.stringify({ error: "Details too large" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch user's actual name from profiles (server-side, not client-supplied)
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    const userName = profile?.full_name || claimsData.claims.email as string || "";

    // Insert using service role (bypasses RLS)
    const { error: insertError } = await serviceClient.from("audit_logs").insert({
      user_id: userId,
      user_name: userName,
      action,
      entity_type,
      entity_id: entity_id || null,
      details: details || null,
    });

    if (insertError) {
      console.error("Audit log insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to write audit log" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("write-audit-log error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
