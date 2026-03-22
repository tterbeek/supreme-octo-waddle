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

type DeauthResult = {
  ok: boolean;
  status: number;
  message: string;
  isAuthError: boolean;
};

const deauthorizeStrava = async (accessToken: string): Promise<DeauthResult> => {
  const deauthPayload = new URLSearchParams({ access_token: accessToken });

  const deauthRes = await fetch("https://www.strava.com/oauth/deauthorize", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: deauthPayload.toString(),
  });

  if (deauthRes.ok) {
    return { ok: true, status: deauthRes.status, message: "", isAuthError: false };
  }

  let body: any = null;
  try {
    body = await deauthRes.json();
  } catch {
    body = null;
  }

  const message = typeof body?.message === "string" ? body.message : "";
  const lower = message.toLowerCase();
  const isAuthError =
    deauthRes.status === 401 ||
    lower.includes("authorization error") ||
    lower.includes("invalid") ||
    lower.includes("expired");

  return {
    ok: false,
    status: deauthRes.status,
    message,
    isAuthError,
  };
};

const refreshAccessToken = async (params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) => {
  const payload = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    data: json,
  };
};

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
    .select("access_token, refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connectionError) {
    return jsonResponse(400, { error: connectionError.message });
  }

  if (connection?.access_token) {
    let deauth = await deauthorizeStrava(connection.access_token);

    // Access token can be stale. Try to mint a current one from refresh token and deauthorize that.
    if (
      !deauth.ok &&
      deauth.isAuthError &&
      connection.refresh_token &&
      stravaClientId &&
      stravaClientSecret
    ) {
      const refreshed = await refreshAccessToken({
        clientId: stravaClientId,
        clientSecret: stravaClientSecret,
        refreshToken: connection.refresh_token,
      });

      if (refreshed.ok && typeof refreshed.data?.access_token === "string") {
        deauth = await deauthorizeStrava(refreshed.data.access_token);
      } else {
        const refreshMessage =
          typeof refreshed.data?.message === "string"
            ? refreshed.data.message.toLowerCase()
            : "";
        const invalidGrant =
          refreshed.status === 400 &&
          (refreshMessage.includes("invalid") ||
            refreshMessage.includes("authorization error") ||
            refreshMessage.includes("expired"));

        if (!invalidGrant) {
          return jsonResponse(400, {
            error: "Could not refresh token to complete Strava deauthorization.",
          });
        }
        // invalid grant usually means Strava auth is already effectively gone
        deauth = { ok: true, status: 200, message: "", isAuthError: false };
      }
    }

    if (!deauth.ok) {
      const safeMessage =
        deauth.message ||
        `Could not revoke Strava authorization (status ${deauth.status}).`;
      return jsonResponse(400, { error: safeMessage });
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
