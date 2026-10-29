import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importStravaActivities } from "../_shared/stravaImport.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
  const stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
  const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
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
  const serviceClient = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonResponse(401, { error: "Not authenticated." });
  }

  if (!serviceClient) return jsonResponse(500, { error: 'Import service is not configured.' });
  let retryActivityId: string | undefined;
  let perPage = 50;
  let page = 1;
  try {
    const body = (await req.json()) as { perPage?: number; page?: number; retryActivityId?: string };
    retryActivityId = body.retryActivityId;
    if (typeof body?.perPage === "number") {
      perPage = Math.max(1, Math.min(100, Math.trunc(body.perPage)));
    }
    if (typeof body?.page === "number") {
      page = Math.max(1, Math.trunc(body.page));
    }
  } catch {
    // optional payload only
  }

  return importStravaActivities({
    serviceClient, userId: user.id, stravaClientId, stravaClientSecret, googleMapsApiKey,
    perPage, page, retryActivityId,
  });
});
