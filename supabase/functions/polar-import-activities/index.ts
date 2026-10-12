import { authorizedUser, corsHeaders, json, requestPolarTokens, tokenExpiresAt } from "../_shared/polar.ts";
import { normalizePolarSession, polarList, polarRangeDateTime, type PolarSession, type PolarSport } from "../_shared/polarImport.ts";

async function polarGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://www.polaraccesslink.com/v4/data/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
    const detail = body.error || body.message;
    throw new Error(`Polar API request failed (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  return response.json() as Promise<T>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  const context = await authorizedUser(req);
  if (!context) return json(401, { error: "Not authenticated." });
  try {
    const { data: connection, error: connectionError } = await context.admin
      .from("user_polar_connections")
      .select("access_token, refresh_token, token_expires_at, last_synced_at")
      .eq("user_id", context.user.id).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return json(404, { error: "Polar is not connected." });
    let accessToken = connection.access_token as string;
    if (Date.parse(connection.token_expires_at) <= Date.now() + 5 * 60_000) {
      const tokens = await requestPolarTokens(new URLSearchParams({
        grant_type: "refresh_token", refresh_token: connection.refresh_token,
      }));
      accessToken = tokens.access_token;
      const { error } = await context.admin.from("user_polar_connections").update({
        access_token: accessToken,
        refresh_token: tokens.refresh_token ?? connection.refresh_token,
        token_expires_at: tokenExpiresAt(tokens),
        updated_at: new Date().toISOString(),
      }).eq("user_id", context.user.id);
      if (error) throw error;
    }

    // A small overlap covers delayed Polar processing; the unique external ID handles retries.
    const now = new Date();
    const earliest = new Date(now.getTime() - 89 * 86400_000);
    const previous = connection.last_synced_at
      ? new Date(Date.parse(connection.last_synced_at) - 2 * 86400_000)
      : earliest;
    const from = previous > earliest ? previous : earliest;
    const to = new Date(now.getTime() + 86400_000);
    const sessionsUrl = new URLSearchParams({
      from: polarRangeDateTime(from), to: polarRangeDateTime(to),
    });
    const [sessionsResult, sportsResult] = await Promise.all([
      polarGet<PolarSession[] | { trainingSessions?: PolarSession[] }>(`training-sessions/list?${sessionsUrl}`, accessToken),
      polarGet<PolarSport[] | { sports?: PolarSport[] }>("sports/list", accessToken),
    ]);
    const sessions = polarList<PolarSession>(sessionsResult, "trainingSessions");
    const sports = new Map(polarList<PolarSport>(sportsResult, "sports").map((sport) => [String(sport.id?.id), sport]));
    let inserted = 0;
    let skipped = 0;
    for (const session of sessions) {
      const activity = normalizePolarSession(session, sports, context.user.id, new Date().toISOString());
      if (!activity) continue;
      const { error } = await context.admin.from("activities").insert(activity);
      if (error?.code === "23505" && error.message?.includes("activities_external_source_external_id_idx")) {
        // A later Polar response may supply distance that was absent at first import.
        // Only fill a missing value while the activity is still awaiting enrichment.
        if (activity.distance_km !== null) {
          const { error: updateError } = await context.admin.from("activities")
            .update({ distance_km: activity.distance_km })
            .eq("user_id", context.user.id)
            .eq("external_source", "polar")
            .eq("external_id", activity.external_id)
            .eq("user_enrichment_status", "pending")
            .is("distance_km", null);
          if (updateError) throw updateError;
        }
        skipped += 1;
        continue;
      }
      if (error) throw error;
      inserted += 1;
    }
    const syncedAt = new Date().toISOString();
    const { error: syncError } = await context.admin.from("user_polar_connections")
      .update({ last_synced_at: syncedAt, updated_at: syncedAt })
      .eq("user_id", context.user.id);
    if (syncError) throw syncError;
    return json(200, { ok: true, fetched: sessions.length, inserted, skipped, synced_at: syncedAt });
  } catch (error) {
    console.error("[polar-import]", error);
    return json(502, { error: error instanceof Error ? error.message : "Could not import Polar workouts." });
  }
});
