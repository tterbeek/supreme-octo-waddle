import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRIORITY_TYPES = [
  "park",
  "natural_feature",
  "point_of_interest",
  "neighborhood",
  "locality",
] as const;

const NEARBY_FALLBACK_TYPES = [
  "park",
  "city_park",
  "state_park",
  "national_park",
  "nature_preserve",
  "garden",
  "hiking_area",
  "scenic_spot",
  "tourist_attraction",
  "historical_landmark",
] as const;

const NEARBY_FALLBACK_RADIUS_METERS = 500;
const NEGATIVE_CACHE_TYPE = "no_meaningful_location";
const TEXT_SEARCH_NATURE_RADIUS_METERS = 1500;
const TEXT_SEARCH_NATURE_QUERIES = ["forest", "nature reserve", "park"] as const;
const NEARBY_PARK_LIKE_TYPES = new Set([
  "park",
  "city_park",
  "state_park",
  "national_park",
  "nature_preserve",
  "garden",
]);
const NEARBY_SECONDARY_TYPES = new Set([
  "hiking_area",
  "scenic_spot",
  "tourist_attraction",
  "historical_landmark",
]);
const TEXT_SEARCH_ALLOWED_TYPES = new Set([
  "park",
  "city_park",
  "state_park",
  "national_park",
  "nature_preserve",
  "garden",
  "hiking_area",
]);

type PriorityType = (typeof PRIORITY_TYPES)[number];

type ActivityPhotoRow = {
  lat?: number | string | null;
  lng?: number | string | null;
};

type GeocodeAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GeocodeResult = {
  formatted_address?: string;
  types?: string[];
  address_components?: GeocodeAddressComponent[];
};

type GeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: GeocodeResult[];
};

type NearbyPlace = {
  displayName?: {
    text?: string;
  };
  primaryType?: string;
  types?: string[];
};

type NearbySearchResponse = {
  places?: NearbyPlace[];
};

type TextSearchResponse = {
  places?: NearbyPlace[];
};

type ResolvedLocation = {
  name: string;
  type: PriorityType;
};

type ActivityLocationTagRow = {
  activity_id: string;
  type: "location";
  value: string;
  metadata: {
    lat: number;
    lng: number;
  };
  source: "photo";
};

type CachedLocationRow = {
  name?: string | null;
  type?: string | null;
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeCoord = (value: number) => Math.round(value * 1e7) / 1e7;

const normalizeKey = (lat: number, lng: number) =>
  `${lat.toFixed(3)},${lng.toFixed(3)}`;

const normalizeName = (value: string | null | undefined) => value?.trim() || "";

const isPoorName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return !normalized || normalized === "unnamed road";
};

const STREET_TERMS = [
  "street",
  "st",
  "road",
  "rd",
  "avenue",
  "ave",
  "lane",
  "ln",
  "drive",
  "dr",
  "boulevard",
  "blvd",
  "way",
  "close",
  "court",
  "ct",
  "place",
  "pl",
  "square",
  "sq",
  "terrace",
  "ter",
  "highway",
  "hwy",
];

const isAddressLikeName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (/\d/.test(normalized)) return true;
  if (normalized.includes(",")) return true;
  return STREET_TERMS.some(
    (term) =>
      normalized === term ||
      normalized.endsWith(` ${term}`) ||
      normalized.includes(` ${term} `)
  );
};

const isUsablePlaceName = (name: string) =>
  !isPoorName(name) && !isAddressLikeName(name);

const isStreetLevelResult = (types: string[] = []) =>
  types.some((type) =>
    [
      "street_address",
      "route",
      "intersection",
      "premise",
      "subpremise",
      "plus_code",
    ].includes(type)
  );

const extractNameFromComponent = (
  components: GeocodeAddressComponent[] = [],
  types: string[]
) => {
  for (const component of components) {
    if (!Array.isArray(component.types)) continue;
    if (component.types.some((type) => types.includes(type))) {
      const value = normalizeName(component.long_name || component.short_name);
      if (value) return value;
    }
  }
  return "";
};

const extractNameFromResult = (result: GeocodeResult, type: PriorityType) => {
  const extraTypes =
    type === "point_of_interest"
      ? ["point_of_interest", "establishment"]
      : [type];
  const componentName = extractNameFromComponent(
    result.address_components || [],
    extraTypes
  );
  if (isUsablePlaceName(componentName)) return componentName;

  const formatted = normalizeName(result.formatted_address);
  if (!formatted) return "";

  // Reverse geocoding often returns street addresses even on place-like result rows.
  // Reject those and only keep a clearly named place.
  const primarySegment = normalizeName(formatted.split(",")[0]);
  return isUsablePlaceName(primarySegment) ? primarySegment : "";
};

const pickPreferredReverseLocation = (
  results: GeocodeResult[]
): ResolvedLocation | null => {
  for (const type of PRIORITY_TYPES) {
    const match = results.find((result) => result.types?.includes(type));
    if (!match) continue;
    const name = extractNameFromResult(match, type);
    if (!name) continue;
    return { name, type };
  }
  return null;
};

const extractLocalityFallback = (
  results: GeocodeResult[]
): ResolvedLocation | null => {
  for (const result of results) {
    const name = extractNameFromComponent(result.address_components || [], [
      "locality",
      "postal_town",
      "administrative_area_level_2",
    ]);
    if (isUsablePlaceName(name)) {
      return { name, type: "locality" };
    }
  }
  return null;
};

const shouldFallbackToNearbyPark = (
  results: GeocodeResult[],
  preferred: ResolvedLocation | null
) => {
  const topResult = results[0];
  const topFormattedAddress = normalizeName(topResult?.formatted_address);
  const topName = topFormattedAddress
    ? normalizeName(topFormattedAddress.split(",")[0])
    : "";
  if (!preferred || !isUsablePlaceName(preferred.name)) return true;
  if (preferred.type === "locality") {
    return !isUsablePlaceName(topName) || isStreetLevelResult(topResult?.types);
  }
  return !isUsablePlaceName(topName) || isStreetLevelResult(topResult?.types);
};

const fetchReverseGeocode = async (
  apiKey: string,
  lat: number,
  lng: number
) => {
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    language: "en",
    key: apiKey,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );
  const payload = (await response.json()) as GeocodeResponse;

  if (!response.ok) {
    throw new Error(
      payload.error_message ||
        `Reverse geocoding failed with status ${response.status}.`
    );
  }

  if (payload.status === "ZERO_RESULTS") {
    return [];
  }

  if (payload.status && payload.status !== "OK") {
    throw new Error(payload.error_message || `Reverse geocoding returned ${payload.status}.`);
  }

  return Array.isArray(payload.results) ? payload.results : [];
};

const fetchNearbyPark = async (
  apiKey: string,
  lat: number,
  lng: number
): Promise<ResolvedLocation | null> => {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.primaryType,places.types",
    },
    body: JSON.stringify({
      includedTypes: [...NEARBY_FALLBACK_TYPES],
      maxResultCount: 8,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: NEARBY_FALLBACK_RADIUS_METERS,
        },
      },
    }),
  });

  const payload = (await response.json()) as NearbySearchResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Nearby search failed with status ${response.status}.`
    );
  }

  const places = Array.isArray(payload.places) ? payload.places : [];

  const pickBestNearbyPlace = (allowedTypes: Set<string>) => {
    for (const place of places) {
      const candidateTypes = [
        place?.primaryType,
        ...(Array.isArray(place?.types) ? place.types : []),
      ].filter((value): value is string => typeof value === "string" && value.length > 0);

      if (!candidateTypes.some((type) => allowedTypes.has(type))) {
        continue;
      }

      const name = normalizeName(place?.displayName?.text);
      if (!isUsablePlaceName(name)) continue;
      return { name, type: "park" as const };
    }
    return null;
  };

  const broadPlace = pickBestNearbyPlace(NEARBY_PARK_LIKE_TYPES);
  if (broadPlace) return broadPlace;

  const secondaryPlace = pickBestNearbyPlace(NEARBY_SECONDARY_TYPES);
  if (secondaryPlace) return secondaryPlace;

  return null;
};

const fetchTextSearchNaturePlace = async (
  apiKey: string,
  lat: number,
  lng: number
): Promise<ResolvedLocation | null> => {
  for (const query of TEXT_SEARCH_NATURE_QUERIES) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.displayName,places.primaryType,places.types",
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius: TEXT_SEARCH_NATURE_RADIUS_METERS,
          },
        },
      }),
    });

    const payload = (await response.json()) as TextSearchResponse & {
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(
        payload.error?.message || `Text search failed with status ${response.status}.`
      );
    }

    const places = Array.isArray(payload.places) ? payload.places : [];
    for (const place of places) {
      const name = normalizeName(place?.displayName?.text);
      if (!isUsablePlaceName(name)) continue;

      const candidateTypes = [
        place?.primaryType,
        ...(Array.isArray(place?.types) ? place.types : []),
      ].filter((value): value is string => typeof value === "string" && value.length > 0);

      if (!candidateTypes.some((type) => TEXT_SEARCH_ALLOWED_TYPES.has(type))) {
        continue;
      }

      return { name, type: "natural_feature" };
    }
  }

  return null;
};

const resolveLocationFromGoogle = async (
  apiKey: string,
  lat: number,
  lng: number
): Promise<ResolvedLocation | null> => {
  const results = await fetchReverseGeocode(apiKey, lat, lng);
  if (results.length === 0) return null;

  const preferred = pickPreferredReverseLocation(results);

  if (
    preferred &&
    !["locality", "neighborhood"].includes(preferred.type) &&
    isUsablePlaceName(preferred.name)
  ) {
    return preferred;
  }

  if (shouldFallbackToNearbyPark(results, preferred)) {
    const nearbyPark = await fetchNearbyPark(apiKey, lat, lng);
    if (nearbyPark) return nearbyPark;
  }

  try {
    const broadNaturePlace = await fetchTextSearchNaturePlace(apiKey, lat, lng);
    if (broadNaturePlace) return broadNaturePlace;
  } catch (error) {
    console.warn("[resolve-activity-location] Text Search fallback failed", error);
  }

  if (preferred && isUsablePlaceName(preferred.name)) {
    return preferred;
  }

  return extractLocalityFallback(results);
};

const deleteLocationTag = async (client: ReturnType<typeof createClient>, activityId: string) => {
  const { error } = await client
    .from("activity_tags")
    .delete()
    .eq("activity_id", activityId)
    .eq("type", "location");

  if (error) throw error;
};

const upsertLocationTag = async (
  client: ReturnType<typeof createClient>,
  tag: ActivityLocationTagRow
) => {
  const { data, error } = await client
    .from("activity_tags")
    .upsert(tag, { onConflict: "activity_id,type" })
    .select("activity_id, type, value, metadata, source")
    .single();

  if (error) throw error;
  return data;
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
  const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables." });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing authorization header." });
  }

  const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await authedClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: "Not authenticated." });
  }

  let body: { activityId?: string } = {};
  try {
    body = (await req.json()) as { activityId?: string };
  } catch {
    body = {};
  }

  const activityId = normalizeName(body.activityId);
  if (!activityId) {
    return jsonResponse(400, { error: "Missing activityId." });
  }

  const { data: activity, error: activityError } = await authedClient
    .from("activities")
    .select("id, photos:activity_photos(lat, lng)")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (activityError) {
    return jsonResponse(500, { error: activityError.message });
  }

  if (!activity) {
    return jsonResponse(404, { error: "Activity not found." });
  }

  const coords = (Array.isArray(activity.photos) ? activity.photos : [])
    .map((photo: ActivityPhotoRow) => {
      const lat = toFiniteNumber(photo.lat);
      const lng = toFiniteNumber(photo.lng);
      if (lat === null || lng === null) return null;
      return { lat, lng };
    })
    .filter((value): value is { lat: number; lng: number } => Boolean(value));

  if (coords.length === 0) {
    await deleteLocationTag(serviceClient, activityId);
    return jsonResponse(200, {
      ok: true,
      updated: true,
      tag: null,
      reason: "no_coords",
    });
  }

  const avgLat = normalizeCoord(
    coords.reduce((sum, item) => sum + item.lat, 0) / coords.length
  );
  const avgLng = normalizeCoord(
    coords.reduce((sum, item) => sum + item.lng, 0) / coords.length
  );
  const cacheKey = normalizeKey(avgLat, avgLng);

  const { data: cached, error: cacheError } = await serviceClient
    .from("location_cache")
    .select("name, type")
    .eq("key", cacheKey)
    .maybeSingle<CachedLocationRow>();

  if (cacheError) {
    return jsonResponse(500, { error: cacheError.message });
  }

  if (cached?.type === NEGATIVE_CACHE_TYPE) {
    await deleteLocationTag(serviceClient, activityId);
    return jsonResponse(200, {
      ok: true,
      updated: true,
      tag: null,
      cached: true,
      reason: NEGATIVE_CACHE_TYPE,
    });
  }

  let resolved: ResolvedLocation | null =
    cached?.name && cached?.type
      ? {
          name: cached.name,
          type: cached.type as PriorityType,
        }
      : null;

  if (!resolved) {
    if (!googleMapsApiKey) {
      return jsonResponse(200, {
        ok: false,
        updated: false,
        tag: null,
        reason: "missing_google_maps_api_key",
      });
    }

    resolved = await resolveLocationFromGoogle(googleMapsApiKey, avgLat, avgLng);

    if (!resolved || !isUsablePlaceName(resolved.name)) {
      const { error: cacheInsertError } = await serviceClient
        .from("location_cache")
        .upsert({
          key: cacheKey,
          lat: avgLat,
          lng: avgLng,
          name: null,
          type: NEGATIVE_CACHE_TYPE,
        });

      if (cacheInsertError) {
        return jsonResponse(500, { error: cacheInsertError.message });
      }

      await deleteLocationTag(serviceClient, activityId);
      return jsonResponse(200, {
        ok: true,
        updated: true,
        tag: null,
        cached: false,
        reason: "no_meaningful_location",
      });
    }

    const { error: cacheInsertError } = await serviceClient
      .from("location_cache")
      .upsert({
        key: cacheKey,
        lat: avgLat,
        lng: avgLng,
        name: resolved.name,
        type: resolved.type,
      });

    if (cacheInsertError) {
      return jsonResponse(500, { error: cacheInsertError.message });
    }
  }

  const tagRow: ActivityLocationTagRow = {
    activity_id: activityId,
    type: "location",
    value: resolved.name,
    metadata: {
      lat: avgLat,
      lng: avgLng,
    },
    source: "photo",
  };

  const tag = await upsertLocationTag(serviceClient, tagRow);

  return jsonResponse(200, {
    ok: true,
    updated: true,
    tag,
    cached: Boolean(cached),
  });
});
