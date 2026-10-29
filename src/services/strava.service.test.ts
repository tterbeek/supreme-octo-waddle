import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { invoke, from } = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../supabaseClient", () => ({
  supabase: { functions: { invoke }, from },
}));

import {
  exchangeStravaCode,
  importRecentStravaActivities,
  startStravaOAuth,
  STRAVA_INTEGRATION_PAUSED,
  syncStravaIfStale,
} from "./strava.service";

describe("active Strava integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_STRAVA_CLIENT_ID", "209776");
    vi.stubGlobal("window", {
      location: { origin: "https://movenotes.app" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("sessionStorage", { setItem: vi.fn() });
    vi.stubGlobal("localStorage", { setItem: vi.fn() });
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("allows OAuth and requests activity access", () => {
    expect(STRAVA_INTEGRATION_PAUSED).toBe(false);
    const url = new URL(startStravaOAuth());
    expect(url.hostname).toBe("www.strava.com");
    expect(url.searchParams.get("client_id")).toBe("209776");
    expect(url.searchParams.get("scope")).toContain("activity:read");
  });

  it("exchanges the authorization code using the existing function", async () => {
    await exchangeStravaCode("test-code");
    expect(invoke).toHaveBeenCalledWith("strava-exchange-token", {
      body: { code: "test-code", redirectUri: "https://movenotes.app/settings/strava/callback" },
    });
  });

  it("imports through the existing function", async () => {
    await importRecentStravaActivities();
    expect(invoke).toHaveBeenCalledWith("strava-import-activities", {
      body: { perPage: 50, page: 1 },
    });
  });

  it("syncs stale connections but preserves the sync cooldown", async () => {
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { strava_athlete_id: 1, last_synced_at: null }, error: null })
      .mockResolvedValueOnce({ data: { strava_athlete_id: 1, last_synced_at: new Date().toISOString() }, error: null });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle }) });
    await expect(syncStravaIfStale()).resolves.toBe(true);
    await expect(syncStravaIfStale()).resolves.toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
