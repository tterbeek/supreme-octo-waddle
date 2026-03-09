import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const RIDE_TYPES = new Set([
  "Ride",
  "MountainBikeRide",
  "GravelRide",
  "EBikeRide",
  "EMountainBikeRide",
  "VirtualRide",
]);
const WALK_TYPES = new Set(["Walk"]);
const HIKE_TYPES = new Set(["Hike"]);
const SWIM_TYPES = new Set(["Swim"]);
const STRENGTH_TYPES = new Set([
  "WeightTraining",
  "Workout",
  "Crossfit",
  "HighIntensityIntervalTraining",
  "Pilates",
  "Elliptical",
  "StairStepper",
]);
const YOGA_TYPES = new Set(["Yoga"]);

type MoveNotesActivityType =
  | "run"
  | "ride"
  | "walk"
  | "strength"
  | "yoga"
  | "hike"
  | "swim"
  | "restore"
  | "other";

type StravaActivity = {
  id: number;
  name?: string | null;
  sport_type?: string | null;
  type?: string | null;
  start_date?: string | null;
  start_date_local?: string | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  distance?: number | null;
};

type StravaConnectionRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
};

type NormalizedImportedActivity = {
  user_id: string;
  type: MoveNotesActivityType;
  date: string;
  started_at: string | null;
  distance_km: number | null;
  duration_min: number | null;
  title: string | null;
  source: "strava";
  external_source: "strava";
  external_id: string;
  raw_sport_type: string | null;
  raw_type: string | null;
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const mapStravaSportTypeToMoveNotesType = (
  sportType?: string | null,
  legacyType?: string | null
): MoveNotesActivityType => {
  const value = sportType ?? legacyType ?? "Other";

  if (RUN_TYPES.has(value)) return "run";
  if (RIDE_TYPES.has(value)) return "ride";
  if (WALK_TYPES.has(value)) return "walk";
  if (HIKE_TYPES.has(value)) return "hike";
  if (SWIM_TYPES.has(value)) return "swim";
  if (STRENGTH_TYPES.has(value)) return "strength";
  if (YOGA_TYPES.has(value)) return "yoga";
  return "other";
};

const toLocalDateString = (
  startDateLocal?: string | null,
  startDate?: string | null
) => {
  const source = startDateLocal ?? startDate;
  if (!source) return new Date().toISOString().slice(0, 10);
  return source.slice(0, 10);
};

const secondsToMinutes = (value?: number | null): number | null => {
  if (typeof value !== "number") return null;
  return Math.round((value / 60) * 100) / 100;
};

const metersToKm = (value?: number | null): number | null => {
  if (typeof value !== "number") return null;
  return Math.round((value / 1000) * 100) / 100;
};

const normalizeStravaActivity = (
  userId: string,
  activity: StravaActivity
): NormalizedImportedActivity => {
  const rawSportType = activity.sport_type ?? null;
  const rawType = activity.type ?? null;

  return {
    user_id: userId,
    type: mapStravaSportTypeToMoveNotesType(rawSportType, rawType),
    date: toLocalDateString(activity.start_date_local, activity.start_date),
    started_at: activity.start_date ?? null,
    distance_km: metersToKm(activity.distance),
    duration_min: secondsToMinutes(
      activity.moving_time ?? activity.elapsed_time ?? null
    ),
    title: activity.name ?? null,
    source: "strava",
    external_source: "strava",
    external_id: String(activity.id),
    raw_sport_type: rawSportType,
    raw_type: rawType,
  };
};

const refreshStravaTokenIfNeeded = async (
  connection: StravaConnectionRow,
  stravaClientId: string,
  stravaClientSecret: string
) => {
  const expiresAtMs = new Date(connection.token_expires_at).getTime();
  const now = Date.now();
  if (Number.isFinite(expiresAtMs) && expiresAtMs - now > REFRESH_LEEWAY_MS) {
    return connection;
  }

  const payload = new URLSearchParams({
    client_id: stravaClientId,
    client_secret: stravaClientSecret,
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : "Failed to refresh Strava token.";
    throw new Error(message);
  }

  const nextExpiresAt =
    typeof data?.expires_at === "number"
      ? new Date(data.expires_at * 1000).toISOString()
      : connection.token_expires_at;

  return {
    ...connection,
    access_token: data?.access_token ?? connection.access_token,
    refresh_token: data?.refresh_token ?? connection.refresh_token,
    token_expires_at: nextExpiresAt,
  };
};

const fetchStravaActivities = async (
  accessToken: string,
  perPage: number,
  page: number
): Promise<StravaActivity[]> => {
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Strava activities: ${res.status} ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? (data as StravaActivity[]) : [];
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

  let perPage = 50;
  let page = 1;
  try {
    const body = (await req.json()) as { perPage?: number; page?: number };
    if (typeof body?.perPage === "number") {
      perPage = Math.max(1, Math.min(100, Math.trunc(body.perPage)));
    }
    if (typeof body?.page === "number") {
      page = Math.max(1, Math.trunc(body.page));
    }
  } catch {
    // optional payload only
  }

  const { data: connection, error: connectionError } = await supabase
    .from("user_strava_connections")
    .select("user_id, access_token, refresh_token, token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connectionError) {
    return jsonResponse(400, { error: connectionError.message });
  }
  if (!connection) {
    return jsonResponse(400, { error: "User has no Strava connection." });
  }

  let validConnection: StravaConnectionRow;
  try {
    validConnection = await refreshStravaTokenIfNeeded(
      connection as StravaConnectionRow,
      stravaClientId,
      stravaClientSecret
    );
  } catch (err: any) {
    return jsonResponse(400, { error: err?.message || "Strava token refresh failed." });
  }

  if (
    validConnection.access_token !== connection.access_token ||
    validConnection.refresh_token !== connection.refresh_token ||
    validConnection.token_expires_at !== connection.token_expires_at
  ) {
    const { error: saveConnError } = await supabase
      .from("user_strava_connections")
      .update({
        access_token: validConnection.access_token,
        refresh_token: validConnection.refresh_token,
        token_expires_at: validConnection.token_expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (saveConnError) {
      return jsonResponse(400, { error: saveConnError.message });
    }
  }

  let stravaActivities: StravaActivity[];
  try {
    stravaActivities = await fetchStravaActivities(
      validConnection.access_token,
      perPage,
      page
    );
  } catch (err: any) {
    return jsonResponse(400, { error: err?.message || "Could not fetch Strava activities." });
  }

  const nowIso = new Date().toISOString();
  let inserted = 0;
  let updated = 0;

  for (const item of stravaActivities) {
    const normalized = normalizeStravaActivity(user.id, item);

    const { data: existing, error: existingError } = await supabase
      .from("activities")
      .select("id")
      .eq("external_source", "strava")
      .eq("external_id", normalized.external_id)
      .maybeSingle();

    if (existingError) {
      return jsonResponse(400, { error: existingError.message });
    }

    const factualPayload = {
      type: normalized.type,
      date: normalized.date,
      started_at: normalized.started_at,
      distance_km: normalized.distance_km,
      duration_min: normalized.duration_min,
      title: normalized.title,
      source: "strava",
      raw_sport_type: normalized.raw_sport_type,
      raw_type: normalized.raw_type,
      last_synced_at: nowIso,
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("activities")
        .update(factualPayload)
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (updateError) {
        return jsonResponse(400, { error: updateError.message });
      }
      updated += 1;
      continue;
    }

    const { error: insertError } = await supabase.from("activities").insert({
      user_id: user.id,
      ...factualPayload,
      feeling: null,
      effort: null,
      external_source: "strava",
      external_id: normalized.external_id,
      imported_at: nowIso,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const { error: conflictUpdateError } = await supabase
          .from("activities")
          .update(factualPayload)
          .eq("external_source", "strava")
          .eq("external_id", normalized.external_id)
          .eq("user_id", user.id);
        if (conflictUpdateError) {
          return jsonResponse(400, { error: conflictUpdateError.message });
        }
        updated += 1;
        continue;
      }
      return jsonResponse(400, { error: insertError.message });
    }

    inserted += 1;
  }

  const { error: connectionSyncError } = await supabase
    .from("user_strava_connections")
    .update({
      last_synced_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", user.id);

  if (connectionSyncError) {
    const message = connectionSyncError.message?.toLowerCase?.() || "";
    const missingLastSynced = message.includes("last_synced_at");
    if (!missingLastSynced) {
      return jsonResponse(400, { error: connectionSyncError.message });
    }

    const { error: fallbackUpdateError } = await supabase
      .from("user_strava_connections")
      .update({ updated_at: nowIso })
      .eq("user_id", user.id);

    if (fallbackUpdateError) {
      return jsonResponse(400, { error: fallbackUpdateError.message });
    }
  }

  return jsonResponse(200, {
    ok: true,
    fetched: stravaActivities.length,
    inserted,
    updated,
    synced_at: nowIso,
  });
});
