import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import polyline from "npm:@mapbox/polyline";
import {
  getLocationPriority,
  resolveLocation,
  type ResolvedLocation,
} from "../_shared/locationResolver.ts";

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
  start_latlng?: [number, number] | null;
  map?: {
    summary_polyline?: string | null;
  } | null;
};

type StravaConnectionRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
};

type RepresentativeCoord = {
  lat: number;
  lng: number;
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
  const minutes = value / 60;
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes === 0) return 0;
  return Math.max(1, Math.round(minutes));
};

const metersToKm = (value?: number | null): number | null => {
  if (typeof value !== "number") return null;
  return Math.round((value / 1000) * 100) / 100;
};

const dedupeCoords = (coords: RepresentativeCoord[]) => {
  const seen = new Set<string>();
  return coords.filter((coord) => {
    const key = `${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const hasStartLatLng = (activity: StravaActivity) =>
  Array.isArray(activity.start_latlng) &&
  activity.start_latlng.length === 2 &&
  typeof activity.start_latlng[0] === "number" &&
  typeof activity.start_latlng[1] === "number";

const hasRouteData = (activity: StravaActivity) =>
  Boolean(activity?.map?.summary_polyline) || hasStartLatLng(activity);

const formatCoordsForLog = (coords: RepresentativeCoord[]) =>
  coords.map((coord) => ({
    lat: Number(coord.lat.toFixed(5)),
    lng: Number(coord.lng.toFixed(5)),
  }));

const normalizePlaceNameForGrouping = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const getLevenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
};

const areLikelySamePlaceName = (a: string, b: string) => {
  const normalizedA = normalizePlaceNameForGrouping(a);
  const normalizedB = normalizePlaceNameForGrouping(b);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (Math.abs(normalizedA.length - normalizedB.length) > 2) return false;
  if (normalizedA.length < 12 || normalizedB.length < 12) return false;

  return getLevenshteinDistance(normalizedA, normalizedB) <= 2;
};

const getRepresentativeCoords = (activity: StravaActivity): RepresentativeCoord[] => {
  const summaryPolyline = activity?.map?.summary_polyline;

  const fallbackStart = (() => {
    if (hasStartLatLng(activity)) {
      return [{ lat: activity.start_latlng[0], lng: activity.start_latlng[1] }];
    }
    return [];
  })();

  if (!summaryPolyline) {
    return fallbackStart;
  }

  let decoded: number[][] = [];
  try {
    decoded = polyline.decode(summaryPolyline) as number[][];
  } catch {
    decoded = [];
  }

  if (decoded.length === 0) {
    return fallbackStart;
  }

  const sampleIndexes = [0.25, 0.5, 0.75].map((fraction) =>
    Math.min(decoded.length - 1, Math.floor(decoded.length * fraction))
  );

  const sampledCoords = sampleIndexes
    .map((index) => decoded[index])
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === "number" &&
        typeof point[1] === "number"
    )
    .map(([lat, lng]) => ({ lat, lng }));

  return dedupeCoords(sampledCoords);
};

const resolveBestLocation = async (
  coords: RepresentativeCoord[],
  params: {
    serviceClient: ReturnType<typeof createClient> | null;
    googleMapsApiKey?: string | null;
    activityId?: number;
  }
): Promise<ResolvedLocation | null> => {
  if (!params.googleMapsApiKey || coords.length === 0) {
    return null;
  }

  const results: ResolvedLocation[] = [];

  for (const coord of coords) {
    const resolved = await resolveLocation({
      serviceClient: params.serviceClient,
      googleMapsApiKey: params.googleMapsApiKey,
      lat: coord.lat,
      lng: coord.lng,
      logPrefix: "[strava-import-activities]",
    });
    if (resolved) {
      results.push(resolved);
    }
  }

  console.log("[strava-import-activities] resolved places", {
    stravaActivityId: params.activityId ?? null,
    coords: formatCoordsForLog(coords),
    results: results.map((result) => ({
      name: result.name,
      type: result.type,
      priority: getLocationPriority(result.type),
    })),
  });

  if (results.length === 0) return null;

  const bestPriority = Math.min(...results.map((result) => getLocationPriority(result.type)));
  const bestPriorityResults = results.filter(
    (result) => getLocationPriority(result.type) === bestPriority
  );

  const groupedByName: Array<{
    key: string;
    count: number;
    firstIndex: number;
    representative: ResolvedLocation;
  }> = [];

  bestPriorityResults.forEach((result, index) => {
    const key = normalizePlaceNameForGrouping(result.name);
    const existing = groupedByName.find((entry) =>
      areLikelySamePlaceName(entry.representative.name, result.name)
    );
    if (existing) {
      existing.count += 1;
      return;
    }
    groupedByName.push({
      count: 1,
      firstIndex: index,
      key,
      representative: result,
    });
  });

  const rankedResults = groupedByName.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.firstIndex - b.firstIndex;
  });

  console.log("[strava-import-activities] ranked place candidates", {
    stravaActivityId: params.activityId ?? null,
    bestPriority,
    bestPriorityResults: bestPriorityResults.map((result, index) => ({
      index,
      name: result.name,
      type: result.type,
    })),
    grouped: rankedResults.map((item) => ({
      name: item.representative.name,
      type: item.representative.type,
      count: item.count,
      firstIndex: item.firstIndex,
    })),
    selected: rankedResults[0]
      ? {
          name: rankedResults[0].representative.name,
          type: rankedResults[0].representative.type,
          count: rankedResults[0].count,
          firstIndex: rankedResults[0].firstIndex,
        }
      : null,
  });

  return rankedResults[0]?.representative ?? null;
};

const generateTitle = (
  activityType: MoveNotesActivityType,
  placeName: string | null
) => {
  if (!placeName) return null;

  const labels: Record<MoveNotesActivityType, string> = {
    run: "Run",
    ride: "Ride",
    walk: "Walk",
    strength: "Workout",
    yoga: "Yoga",
    hike: "Hike",
    swim: "Swim",
    restore: "Recovery",
    other: "Activity",
  };

  return `${labels[activityType] || "Activity"} in ${placeName}`;
};

const getSmartActivityTitle = async (
  activity: StravaActivity,
  activityType: MoveNotesActivityType,
  params: {
    serviceClient: ReturnType<typeof createClient> | null;
    googleMapsApiKey?: string | null;
  }
) => {
  const coords = getRepresentativeCoords(activity);
  console.log("[strava-import-activities] smart title coords", {
    stravaActivityId: activity.id,
    stravaName: activity.name ?? null,
    activityType,
    coords: formatCoordsForLog(coords),
  });
  if (coords.length === 0) return null;

  const place = await resolveBestLocation(coords, {
    ...params,
    activityId: activity.id,
  });
  console.log("[strava-import-activities] smart title place choice", {
    stravaActivityId: activity.id,
    place: place ? { name: place.name, type: place.type } : null,
  });
  if (!place) return null;

  const title = generateTitle(activityType, place.name);
  console.log("[strava-import-activities] smart title generated", {
    stravaActivityId: activity.id,
    title,
  });
  return title;
};

const normalizeStravaActivity = (
  userId: string,
  activity: StravaActivity,
  titleOverride?: string | null
): NormalizedImportedActivity => {
  const rawSportType = activity.sport_type ?? null;
  const rawType = activity.type ?? null;
  const normalizedType = mapStravaSportTypeToMoveNotesType(rawSportType, rawType);

  return {
    user_id: userId,
    type: normalizedType,
    date: toLocalDateString(activity.start_date_local, activity.start_date),
    started_at: activity.start_date ?? null,
    distance_km: metersToKm(activity.distance),
    duration_min: secondsToMinutes(
      activity.moving_time ?? activity.elapsed_time ?? null
    ),
    title: titleOverride ?? activity.name ?? null,
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

const fetchStravaActivityDetail = async (
  accessToken: string,
  activityId: number
): Promise<StravaActivity> => {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch Strava activity detail ${activityId}: ${res.status} ${text}`
    );
  }

  return (await res.json()) as StravaActivity;
};

const ensureRouteData = async (
  activity: StravaActivity,
  accessToken: string
): Promise<StravaActivity> => {
  if (hasRouteData(activity)) {
    return activity;
  }

  try {
    return await fetchStravaActivityDetail(accessToken, activity.id);
  } catch (error) {
    console.warn(
      "[strava-import-activities] activity detail fallback failed",
      error
    );
    return activity;
  }
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
  let skippedExisting = 0;

  for (const listItem of stravaActivities) {
    const item = await ensureRouteData(listItem, validConnection.access_token);
    const rawSportType = item.sport_type ?? null;
    const rawType = item.type ?? null;
    const activityType = mapStravaSportTypeToMoveNotesType(rawSportType, rawType);
    const smartTitle = await getSmartActivityTitle(item, activityType, {
      serviceClient,
      googleMapsApiKey,
    });
    const normalized = normalizeStravaActivity(user.id, item, smartTitle);

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
      skippedExisting += 1;
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
        skippedExisting += 1;
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
    skipped_existing: skippedExisting,
    synced_at: nowIso,
  });
});
