import { authorizedUser, corsHeaders, json, requestPolarTokens, tokenExpiresAt } from "../_shared/polar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  const context = await authorizedUser(req);
  if (!context) return json(401, { error: "Not authenticated." });
  try {
    const { code, redirectUri } = await req.json() as { code?: string; redirectUri?: string };
    const allowedRedirect = Deno.env.get("POLAR_REDIRECT_URI");
    if (!code || !redirectUri || !allowedRedirect || redirectUri !== allowedRedirect) {
      return json(400, { error: "Invalid Polar authorization request or redirect URL." });
    }
    const tokens = await requestPolarTokens(new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: redirectUri,
    }));
    if (!tokens.refresh_token) throw new Error("Polar did not return a refresh token.");
    const { error } = await context.admin.from("user_polar_connections").upsert({
      user_id: context.user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokenExpiresAt(tokens),
      last_synced_at: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return json(200, { ok: true });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : "Could not connect Polar." });
  }
});
