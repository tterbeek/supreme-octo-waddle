import { authorizedUser, corsHeaders, json, requestPolarTokens, tokenExpiresAt } from "../_shared/polar.ts";
import { normalizePolarSession, polarList, polarRangeDateTime, polarRouteDayQuery, polarTitleInput, type PolarSession, type PolarSport } from "../_shared/polarImport.ts";
import { generateImportedActivityTitle } from "../_shared/importedActivityTitle.ts";
import { polarRoutePolyline } from "../_shared/activityRoute.ts";
import { finishActivityImport, importCanRetry, type ImportAttempt } from "../_shared/activityImport.ts";
import { importedLocalityResolver, scheduleImportedTitleJobs } from "../_shared/importedTitleEnrichment.ts";

async function polarGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://www.polaraccesslink.com/v4/data/${path}`, {
    signal: AbortSignal.timeout(10_000),
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

    const body = await req.json().catch(() => ({}));
    let retry: { id: string; date: string; external_id: string } | null = null;
    if (body.retryActivityId) {
      const { data, error } = await context.admin.from('activities').select('id,date,external_id,import_status,import_updated_at')
        .eq('id', body.retryActivityId).eq('user_id', context.user.id).eq('external_source', 'polar').maybeSingle();
      if (error) throw error;
      if (!data || !importCanRetry(data.import_status, data.import_updated_at)) return json(409, { error: 'This import is not ready to retry.' });
      retry = data;
    }
    // A small overlap covers delayed Polar processing; the unique external ID handles retries.
    const now = new Date();
    // Date-only API bounds: today plus the previous 89 days = 90 calendar days.
    const historyDays = 90;
    const earliest = new Date(now.getTime() - (historyDays - 1) * 86400_000);
    const previous = connection.last_synced_at
      ? new Date(Date.parse(connection.last_synced_at) - 2 * 86400_000)
      : earliest;
    const from = previous > earliest ? previous : earliest;
    const to = new Date(now.getTime() + 86400_000);
    const sessionsUrl = new URLSearchParams({
      from: polarRangeDateTime(from), to: polarRangeDateTime(to),
    });
    const [sessionsResult, sportsResult] = await Promise.all([
      polarGet<PolarSession[] | { trainingSessions?: PolarSession[] }>(`training-sessions/list?${retry ? polarRouteDayQuery(retry.date) : sessionsUrl}`, accessToken),
      polarGet<PolarSport[] | { sports?: PolarSport[] }>("sports/list", accessToken),
    ]);
    const sessions = polarList<PolarSession>(sessionsResult, "trainingSessions").filter(session => !retry || String(session.identifier?.id) === retry.external_id);
    if (retry && !sessions.length) return json(404, { error: "Polar no longer returned this workout. Please try again later." });
    const sports = new Map(polarList<PolarSport>(sportsResult, "sports").map((sport) => [String(sport.id?.id), sport]));
    let inserted = 0;
    let skipped = 0;
    const jobs: (() => Promise<void>)[] = [];
    // Share a route lookup between activities on the same local day.
    const days = new Map<string, Promise<PolarSession[]>>();
    for (const session of sessions) {
      const activity = normalizePolarSession(session, sports, context.user.id, new Date().toISOString());
      if (!activity) continue;
      const token = crypto.randomUUID();
      const state = { import_status: 'processing', import_token: token, import_updated_at: new Date().toISOString() };
      let attempt: ImportAttempt | null = null;
      const { data: saved, error } = await context.admin.from('activities').insert({ ...activity, ...state })
        .select('id,user_id,import_token').single();
      if (error?.code === '23505') {
        const { data: existing, error: lookupError } = await context.admin.from('activities')
          .select('id,import_status,import_updated_at,import_token').eq('user_id', context.user.id)
          .eq('external_source', 'polar').eq('external_id', activity.external_id).maybeSingle();
        if (lookupError) throw lookupError;
        if (existing && importCanRetry(existing.import_status, existing.import_updated_at)) {
          let claim = context.admin.from('activities').update(state).eq('id', existing.id).eq('user_id', context.user.id)
            .eq('import_status', existing.import_status);
          claim = existing.import_token ? claim.eq('import_token', existing.import_token) : claim.is('import_token', null);
          const { data: claimed, error: claimError } = await claim.select('id,user_id,import_token').maybeSingle();
          if (claimError) throw claimError;
          attempt = claimed;
        } else if (activity.distance_km !== null) {
          // Preserve the existing missing-distance backfill, without touching edited data.
          const { error: fillError } = await context.admin.from('activities').update({ distance_km: activity.distance_km })
            .eq('user_id', context.user.id).eq('external_source', 'polar').eq('external_id', activity.external_id)
            .eq('user_enrichment_status', 'pending').eq('import_status', 'ready').is('distance_km', null);
          if (fillError) throw fillError;
        }
        skipped += 1;
      } else {
        if (error) throw error;
        attempt = saved;
        inserted += 1;
      }
      if (!attempt) continue;
      const currentAttempt = attempt;
      jobs.push(() => finishActivityImport(context.admin, currentAttempt, async () => {
        let detailed = days.get(activity.date);
        if (!detailed) {
          detailed = polarGet<PolarSession[] | { trainingSessions?: PolarSession[] }>(
            `training-sessions/list?${polarRouteDayQuery(activity.date)}`, accessToken,
          ).then(result => polarList<PolarSession>(result, 'trainingSessions'));
          days.set(activity.date, detailed);
        }
        const withRoute = (await detailed).find(item => String(item.identifier?.id) === String(session.identifier?.id));
        if (!withRoute) throw new Error('Workout details not available yet.');
        const complete = { ...session, ...withRoute };
        const title = await generateImportedActivityTitle(polarTitleInput(complete, activity.type, sports), {
          resolveLocality: importedLocalityResolver(context.admin, Deno.env.get('GOOGLE_MAPS_API_KEY')),
        });
        return { title, route_polyline: polarRoutePolyline(complete), route_checked_at: new Date().toISOString() };
      }));
    }
    scheduleImportedTitleJobs(jobs);
    const syncedAt = new Date().toISOString();
    const { error: syncError } = retry ? { error: null } : await context.admin.from("user_polar_connections")
      .update({ last_synced_at: syncedAt, updated_at: syncedAt })
      .eq("user_id", context.user.id);
    if (syncError) throw syncError;
    return json(200, { ok: true, fetched: sessions.length, inserted, skipped, synced_at: syncedAt });
  } catch (error) {
    console.error("[polar-import]", error);
    return json(502, { error: error instanceof Error ? error.message : "Could not import Polar workouts." });
  }
});
