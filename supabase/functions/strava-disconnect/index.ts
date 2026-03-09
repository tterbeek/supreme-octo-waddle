import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, { error: "Function env vars are not configured." });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing Authorization header." });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: "Not authenticated." });
  }

  const { data: connection, error: connectionError } = await supabase
    .from("user_strava_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connectionError) {
    return jsonResponse(400, { error: connectionError.message });
  }

  if (connection?.access_token) {
    const deauthPayload = new URLSearchParams({
      access_token: connection.access_token,
    });

    const deauthRes = await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: deauthPayload.toString(),
    });

    if (!deauthRes.ok) {
      let body: any = null;
      try {
        body = await deauthRes.json();
      } catch {
        // keep null and fall through
      }
      const message = typeof body?.message === "string" ? body.message : "";
      const isAlreadyInvalid =
        deauthRes.status === 401 ||
        message.toLowerCase().includes("authorization error");
      if (!isAlreadyInvalid) {
        const safeMessage = message || "Could not revoke Strava authorization.";
        return jsonResponse(400, { error: safeMessage });
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("user_strava_connections")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    return jsonResponse(400, { error: deleteError.message });
  }

  return jsonResponse(200, { ok: true });
});
