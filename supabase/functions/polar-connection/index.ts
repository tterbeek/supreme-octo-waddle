import { authorizedUser, corsHeaders, json } from "../_shared/polar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  const context = await authorizedUser(req);
  if (!context) return json(401, { error: "Not authenticated." });
  const body = await req.json().catch(() => ({})) as { disconnect?: boolean };
  if (body.disconnect) {
    const { error } = await context.admin.from("user_polar_connections")
      .delete().eq("user_id", context.user.id);
    if (error) return json(500, { error: "Could not disconnect Polar." });
    return json(200, { connected: false });
  }
  const { data, error } = await context.admin.from("user_polar_connections")
    .select("last_synced_at").eq("user_id", context.user.id).maybeSingle();
  if (error) return json(500, { error: "Could not read Polar connection." });
  return json(200, { connected: Boolean(data), last_synced_at: data?.last_synced_at ?? null });
});
