import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), storageFrom: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { auth: { getUser: mock.getUser }, from: mock.from, storage: { from: mock.storageFrom } } }));
vi.mock('../lib/mapbox', () => ({ mapboxToken: 'pk.fixture', mapboxStyle: 'mapbox/outdoors-v12' }));
import { loadActivityImageMap, loadActivityImagePhoto, loadOwnedActivityImage } from "./activityImage.service";
import { encodeRoute } from '../../supabase/functions/_shared/activityRoute';

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

it("requires a real authenticated user before looking up an activity", async () => {
  mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(loadOwnedActivityImage("some-id", "metric")).rejects.toThrow("Sign in");
  expect(mock.from).not.toHaveBeenCalled();
});

it("checks owner on the saved activity and attachments and performs no writes", async () => {
  mock.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  const queries: { table: string; select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> }[] = [];
  mock.from.mockImplementation((table: string) => {
    const q = {
      table,
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { type: "walk", source: "polar", title: "Saved walk", date: "2026-10-17", distance_km: null, duration_min: 20 }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    queries.push(q); return q;
  });
  const result = await loadOwnedActivityImage("activity", "metric");
  expect(result.model.title).toBe("Saved walk");
  expect(result.model.source).toBe("polar");
  expect(result.model.metrics).toEqual(["20min"]);
  expect(result.photos).toEqual([]);
  expect(queries.map(q => q.table)).toEqual(["activities", "activity_photos", "activity_preferences"]);
  for (const query of queries) expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(queries[0].eq).toHaveBeenCalledWith("id", "activity");
  expect(queries[1].eq).toHaveBeenCalledWith("activity_id", "activity");
  expect(queries[0].select.mock.calls[0][0]).not.toMatch(/\bnotes\b|feeling|effort|user_id|location/);
});

it("does not continue when the owned activity lookup is rejected", async () => {
  mock.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: { message: "not owned" } }) };
  mock.from.mockReturnValue(query);
  await expect(loadOwnedActivityImage("someone-elses-id", "metric")).rejects.toThrow("Couldn't load");
  expect(mock.from).toHaveBeenCalledTimes(1);
});

it("downloads through authenticated storage, not an old signed URL or arbitrary external host", async () => {
  const download = vi.fn().mockResolvedValue({ data: new Blob(["photo"]), error: null });
  mock.storageFrom.mockReturnValue({ download });
  await loadActivityImagePhoto("https://example.supabase.co/storage/v1/object/sign/actvity-notes/owner/photo.jpg?token=EXPIRED");
  expect(download).toHaveBeenCalledExactlyOnceWith("owner/photo.jpg");
  await expect(loadActivityImagePhoto("https://other-host/photo.jpg")).rejects.toThrow();
  expect(download).toHaveBeenCalledTimes(1);
});

it('does not send short hidden routes to Mapbox and never silently falls back to the full route', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const route = encodeRoute([[50, 4], [50.001, 4]])!;
  await expect(loadActivityImageMap(route, true)).rejects.toThrow('Not enough route remains');
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue(new Response(new Blob(['fictional map'], { type: 'image/png' })));
  expect((await loadActivityImageMap(route, false)).type).toBe('image/png');
  expect(fetch).toHaveBeenCalledOnce();
});

it('fetches only clipped geometry, omits credentials, and rejects map errors', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  const route = encodeRoute([[50, 4], [50.02, 4], [50.04, 4]])!;
  await expect(loadActivityImageMap(route, true)).rejects.toThrow('The map could not load');
  expect(fetch.mock.calls[0][0]).not.toContain(encodeURIComponent(route));
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
});
