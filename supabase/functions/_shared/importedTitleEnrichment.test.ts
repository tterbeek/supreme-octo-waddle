import { afterEach, describe, expect, it, vi } from "vitest";
import { applyImportedTitle, importedLocalityResolver, localityFromGeocode, runImportedTitleJobs, scheduleImportedTitleJobs, type ImportedTitleSnapshot } from "./importedTitleEnrichment";
import { generateImportedActivityTitle } from "./importedActivityTitle";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("locality-only geocoding", () => {
  it("reads vetted locality components, never a formatted address, street, neighbourhood, park, country or state", () => {
    expect(localityFromGeocode([{ address_components: [{ long_name: "Brussels", types: ["locality"] }] }])).toBe("Brussels");
    expect(localityFromGeocode([{ address_components: [{ long_name: "Some park", types: ["park"] }, { long_name: "Belgium", types: ["country"] }] }])).toBeNull();
    expect(localityFromGeocode([{ address_components: [{ long_name: "Ghent", types: ["postal_town"] }] }])).toBe("Ghent");
    expect(localityFromGeocode([{ address_components: [{ long_name: "Woluwe-Saint-Lambert", types: ["administrative_area_level_3"] }] }])).toBe("Woluwe-Saint-Lambert");
    expect(localityFromGeocode([{ address_components: [{ long_name: "123 Street Road", types: ["locality"] }] }])).toBeNull();
  });
  it("does not call a paid geocoder when the server key is missing", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await importedLocalityResolver({} as never, undefined)({ lat: 50.85, lng: 4.35 })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reuses a separate coarse locality cache, avoiding old park/POI cache semantics", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: { type: "locality", name: "Ghent" }, error: null });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await importedLocalityResolver({ from: () => query } as never, "not-a-real-key")({ lat: 50.851234, lng: 4.351234 })).toBe("Ghent");
    expect(query.eq).toHaveBeenCalledWith("key", "import-locality:50.851,4.351");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("geocodes only the offset route point and caches only a coarse point plus locality", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), upsert: vi.fn().mockResolvedValue({ error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: "OK", results: [{ address_components: [{ long_name: "Brussels", types: ["locality"] }] }] })));
    vi.stubGlobal("fetch", fetcher);
    const resolver = importedLocalityResolver({ from: () => query } as never, "fake-test-key");
    const title = await generateImportedActivityTitle({ activityType: "run", startedAt: "2026-10-23T05:30:00", providerTitle: "Run", route: [{ lat: 50.85, lng: 4.35 }, { lat: 50.853, lng: 4.35 }] }, { resolveLocality: resolver });
    expect(title).toBe("Early morning run Brussels");
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("latlng")).not.toBe("50.85,4.35");
    expect(url.searchParams.get("result_type")).not.toContain("street_address");
    expect(query.upsert).toHaveBeenCalledWith({ key: "import-locality:50.851,4.35", lat: 50.851, lng: 4.35, name: "Brussels", type: "locality" });
  });
});

const snapshot: ImportedTitleSnapshot = { id: "activity-1", user_id: "owner", title: "Early morning run", type: "run", external_source: "polar", external_id: "session-1", started_at: "2026-10-23T03:30:00Z", note_updated_at: "2026-10-23T08:00:00Z", user_enrichment_status: "pending" };
function database(row = { ...snapshot }) {
  const filters: [string, unknown][] = [];
  let updates: Record<string, unknown> = {};
  const query = {
    update: vi.fn((value: Record<string, unknown>) => { updates = value; return query; }),
    eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
    is: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
    then: (resolve: (value: unknown) => void) => {
      if (filters.every(([key, value]) => row[key as keyof ImportedTitleSnapshot] === value)) Object.assign(row, updates);
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  return { client: { from: vi.fn(() => query) } as never, query, row };
}
describe("safe asynchronous title updates", () => {
  it("changes only the inserted owner's unchanged title and never inserts another activity", async () => {
    const db = database();
    await applyImportedTitle(db.client, snapshot, "Early morning run Brussels");
    expect(db.row.title).toBe("Early morning run Brussels");
    expect(db.query.update).toHaveBeenCalledWith({ title: "Early morning run Brussels" });
    expect(db.query.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(db.query.eq).toHaveBeenCalledWith("external_id", "session-1");
  });
  it.each([
    { title: "My custom run" }, { note_updated_at: "2026-10-23T08:01:00Z" },
    { user_enrichment_status: "completed" }, { user_id: "different-user" }, { external_id: "different-session" },
  ])("does not overwrite a row that changed during the lookup: %j", async changed => {
    const row = { ...snapshot, ...changed };
    const db = database(row);
    await applyImportedTitle(db.client, snapshot, "Early morning run Brussels");
    expect(db.row).toEqual(row);
    expect(db.row.title).not.toBe("Early morning run Brussels");
  });
  it("does not write anything when geocoding yielded only the existing fallback", async () => {
    const db = database();
    await applyImportedTitle(db.client, snapshot, snapshot.title);
    expect(db.query.update).not.toHaveBeenCalled();
  });
  it("registers work without awaiting geocoding, so creation can return immediately", async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const waitUntil = vi.fn(); vi.stubGlobal("EdgeRuntime", { waitUntil });
    expect(scheduleImportedTitleJobs([() => pending])).toBeUndefined();
    expect(waitUntil).toHaveBeenCalledTimes(1);
    finish(); await waitUntil.mock.calls[0][0];
  });
  it("bounds background concurrency, isolates failures and does not log provider/GPS data", async () => {
    let active = 0; let peak = 0;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runImportedTitleJobs(Array.from({ length: 8 }, (_, index) => async () => {
      active++; peak = Math.max(peak, active); await Promise.resolve(); active--;
      if (index === 0) throw new Error("PRIVATE GPS COORDINATES");
    }));
    expect(peak).toBeLessThanOrEqual(3); expect(active).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1); expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE");
  });
});
