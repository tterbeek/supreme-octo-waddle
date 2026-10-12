import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("paused Strava integration", () => {
  beforeEach(() => {
    invoke.mockClear();
    from.mockClear();
  });

  it("blocks new connections, callbacks, and imports without contacting Supabase", async () => {
    expect(STRAVA_INTEGRATION_PAUSED).toBe(true);
    expect(() => startStravaOAuth()).toThrow(/paused/);
    await expect(exchangeStravaCode("unused-code")).rejects.toThrow(/paused/);
    await expect(importRecentStravaActivities()).rejects.toThrow(/paused/);
    expect(invoke).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("skips automatic syncing without reading the connection", async () => {
    await expect(syncStravaIfStale()).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
