import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function authorizedUser(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !auth) return null;
  const browserClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await browserClient.auth.getUser();
  if (error || !user) return null;
  return { user, admin: createClient(url, serviceKey) };
}

export type PolarTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function requestPolarTokens(body: URLSearchParams): Promise<PolarTokens> {
  const clientId = Deno.env.get("POLAR_CLIENT_ID");
  const secret = Deno.env.get("POLAR_CLIENT_SECRET");
  if (!clientId || !secret) throw new Error("Polar credentials are not configured.");
  const response = await fetch("https://auth.polar.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`Polar token request failed (${response.status}).`);
  const tokens = await response.json() as PolarTokens;
  if (!tokens.access_token || !Number.isFinite(tokens.expires_in)) {
    throw new Error("Polar returned an invalid token response.");
  }
  return tokens;
}

export function tokenExpiresAt(tokens: PolarTokens) {
  return new Date(Date.now() + Math.max(0, tokens.expires_in - 60) * 1000).toISOString();
}
