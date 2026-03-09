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
  const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
  const stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

  if (!supabaseUrl || !supabaseAnonKey || !stravaClientId || !stravaClientSecret) {
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

  let code = "";
  let redirectUri = "";
  try {
    const body = (await req.json()) as { code?: string; redirectUri?: string };
    code = body.code || "";
    redirectUri = body.redirectUri || "";
  } catch {
    return jsonResponse(400, { error: "Invalid request body." });
  }

  if (!code) {
    return jsonResponse(400, { error: "Missing authorization code." });
  }

  const payload = new URLSearchParams({
    client_id: stravaClientId,
    client_secret: stravaClientSecret,
    code,
    grant_type: "authorization_code",
  });

  if (redirectUri) {
    payload.set("redirect_uri", redirectUri);
  }

  const stravaRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  let stravaJson: any = null;
  try {
    stravaJson = await stravaRes.json();
  } catch {
    if (!stravaRes.ok) {
      return jsonResponse(400, { error: "Strava token exchange failed." });
    }
  }

  if (!stravaRes.ok) {
    const message =
      typeof stravaJson?.message === "string"
        ? stravaJson.message
        : "Strava token exchange failed.";
    return jsonResponse(400, { error: message });
  }

  const athleteId = stravaJson?.athlete?.id;
  const accessToken = stravaJson?.access_token;
  const refreshToken = stravaJson?.refresh_token;
  const expiresAt = stravaJson?.expires_at;

  if (!athleteId || !accessToken || !refreshToken || !expiresAt) {
    return jsonResponse(400, { error: "Unexpected response from Strava." });
  }

  const tokenExpiresAtIso = new Date(Number(expiresAt) * 1000).toISOString();
  const timestampIso = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from("user_strava_connections")
    .upsert(
      {
        user_id: user.id,
        strava_athlete_id: athleteId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAtIso,
        updated_at: timestampIso,
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    if (
      upsertError.code === "23505" &&
      upsertError.message?.includes?.(
        "user_strava_connections_strava_athlete_id_key"
      )
    ) {
      return jsonResponse(409, {
        error:
          "This Strava account is already connected to another MoveNotes user.",
      });
    }
    return jsonResponse(400, { error: upsertError.message });
  }

  return jsonResponse(200, {
    ok: true,
    athlete_id: athleteId,
    token_expires_at: tokenExpiresAtIso,
  });
});
