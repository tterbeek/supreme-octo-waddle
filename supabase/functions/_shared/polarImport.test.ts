import { describe, expect, it } from "vitest";
import { normalizePolarSession, polarList, polarRangeDateTime, type PolarSport } from "./polarImport";

const sports = new Map<string, PolarSport>([
  ["101", { id: { id: "101" }, name: "TRAIL_RUNNING" }],
  ["102", { id: { id: "102" }, name: "ROAD_CYCLING" }],
]);
const workout = {
  identifier: { id: "polar-session-123" },
  startTime: "2026-10-12T07:30:00Z",
  stopTime: "2026-10-12T08:16:00Z",
  durationMillis: 2_760_000,
  distanceMeters: 8_400,
  name: "Morning Run",
  sport: { id: "101" },
};

describe("Polar session normalization", () => {
  it("uses Polar's accepted local date-time range format", () => {
    expect(polarRangeDateTime(new Date("2026-10-12T09:30:00Z"))).toBe("2026-10-12T00:00:00");
  });

  it("accepts both bare and wrapped list responses", () => {
    const items = [{ id: 1 }];
    expect(polarList(items, "sports")).toEqual(items);
    expect(polarList({ sports: items }, "sports")).toEqual(items);
    expect(polarList({}, "sports")).toEqual([]);
  });

  it("creates a pending imported activity with stable provider identity", () => {
    expect(normalizePolarSession(workout, sports, "user-1", "2026-10-12T09:00:00Z"))
      .toEqual(expect.objectContaining({
        type: "run", date: "2026-10-12", distance_km: 8.4,
        duration_min: 46, source: "polar", external_source: "polar",
        external_id: "polar-session-123", user_enrichment_status: "pending",
      }));
  });

  it("uses exercise distance when Polar omits session distance", () => {
    const session = { ...workout, distanceMeters: undefined, exercises: [{ distanceMeters: 3000 }, { distanceMeters: 2000 }] };
    expect(normalizePolarSession(session, sports, "user-1", "now")?.distance_km).toBe(5);
  });

  it("keeps session distance authoritative and avoids partial exercise totals", () => {
    const exercises = [{ distanceMeters: 3000 }, { distanceMeters: 2000 }];
    expect(normalizePolarSession({ ...workout, exercises }, sports, "user-1", "now")?.distance_km).toBe(8.4);
    expect(normalizePolarSession({ ...workout, distanceMeters: undefined, exercises: [{ distanceMeters: 3000 }, {}] }, sports, "user-1", "now")?.distance_km).toBeNull();
  });

  it("maps cycling and rejects sessions that are not completed", () => {
    expect(normalizePolarSession({ ...workout, sport: { id: "102" } }, sports, "user-1", "now")?.type)
      .toBe("ride");
    expect(normalizePolarSession({ ...workout, stopTime: undefined }, sports, "user-1", "now"))
      .toBeNull();
  });
});
