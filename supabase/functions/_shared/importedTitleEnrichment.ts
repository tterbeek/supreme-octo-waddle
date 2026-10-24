import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateImportedActivityTitle, sensibleLocality, type ImportedTitleInput, type RoutePoint } from "./importedActivityTitle.ts";

export type ImportedTitleSnapshot = {
  id: string; user_id: string; title: string; type: string; external_source: string;
  external_id: string; started_at: string | null; note_updated_at: string | null; user_enrichment_status: string;
};

type GeocodeResult = { address_components?: { long_name?: string; types?: string[] }[] };
/** Never use formatted_address, street components, parks or neighbourhoods. */
export function localityFromGeocode(results: GeocodeResult[]) {
  for (const type of ["locality", "postal_town", "administrative_area_level_3", "administrative_area_level_4"]) {
    for (const result of results) for (const component of result.address_components ?? []) {
      if (component.types?.includes(type)) {
        const name = sensibleLocality(component.long_name);
        if (name) return name;
      }
    }
  }
  return null;
}

/** Reuse the existing server-side Google key and location cache, with a separate
 * coarse key namespace so older park/POI cache entries cannot become titles. */
export function importedLocalityResolver(client: SupabaseClient, apiKey: string | undefined) {
  return async (point: RoutePoint): Promise<string | null> => {
    if (!apiKey) return null;
    const lat = Number(point.lat.toFixed(3));
    const lng = Number(point.lng.toFixed(3));
    const key = `import-locality:${lat},${lng}`;
    const { data: cached } = await client.from("location_cache").select("name, type").eq("key", key).maybeSingle();
    if (cached?.type === "locality") return sensibleLocality(cached.name);
    const params = new URLSearchParams({ latlng: `${point.lat},${point.lng}`, language: "en", key: apiKey,
      result_type: "locality|postal_town|administrative_area_level_3|administrative_area_level_4" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const payload = await response.json() as { status?: string; results?: GeocodeResult[] };
    if (payload.status !== "OK" || !Array.isArray(payload.results)) return null;
    const name = localityFromGeocode(payload.results);
    if (name) await client.from("location_cache").upsert({ key, lat, lng, name, type: "locality" });
    return name;
  };
}

/** Atomic compare-and-set: a late lookup must not overwrite any user handling,
 * even if they deliberately kept the generated base title. Never recreate rows. */
export async function applyImportedTitle(client: SupabaseClient, snapshot: ImportedTitleSnapshot, title: string) {
  if (title === snapshot.title) return;
  let query = client.from("activities").update({ title })
    .eq("id", snapshot.id).eq("user_id", snapshot.user_id).eq("title", snapshot.title)
    .eq("type", snapshot.type).eq("external_source", snapshot.external_source).eq("external_id", snapshot.external_id)
    .eq("user_enrichment_status", snapshot.user_enrichment_status);
  query = snapshot.started_at === null ? query.is("started_at", null) : query.eq("started_at", snapshot.started_at);
  query = snapshot.note_updated_at === null ? query.is("note_updated_at", null) : query.eq("note_updated_at", snapshot.note_updated_at);
  const { error } = await query;
  if (error) throw new Error("Could not apply imported title.");
}

export async function enrichImportedTitle(client: SupabaseClient, snapshot: ImportedTitleSnapshot, input: ImportedTitleInput, apiKey?: string) {
  const title = await generateImportedActivityTitle(input, { resolveLocality: importedLocalityResolver(client, apiKey) });
  await applyImportedTitle(client, snapshot, title);
}

export async function runImportedTitleJobs(jobs: (() => Promise<void>)[]) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
    while (index < jobs.length) {
      const job = jobs[index++];
      try { await job(); } catch { console.warn("Imported title locality unavailable; keeping the base title."); }
    }
  }));
}

export function scheduleImportedTitleJobs(jobs: (() => Promise<void>)[]) {
  if (!jobs.length) return;
  const work = runImportedTitleJobs(jobs);
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(work);
  else void work; // Tests/non-edge execution; each job catches its own failures.
}
