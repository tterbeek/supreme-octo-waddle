import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), storageFrom: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { auth: { getUser: mock.getUser }, from: mock.from, storage: { from: mock.storageFrom } } }));
import { loadActivityImagePhoto, loadOwnedActivityImage } from "./activityImage.service";

beforeEach(() => { vi.resetAllMocks(); });

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
      single: vi.fn().mockResolvedValue({ data: { type: "walk", title: "Saved walk", date: "2026-10-17", distance_km: null, duration_min: 20 }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    queries.push(q); return q;
  });
  const result = await loadOwnedActivityImage("activity", "metric");
  expect(result.model.title).toBe("Saved walk");
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
