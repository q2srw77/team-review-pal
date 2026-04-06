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
            status: 500,
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
            status: 500,
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
      await supabase.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await supabase.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
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
