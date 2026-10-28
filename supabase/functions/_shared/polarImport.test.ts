import { describe, expect, it } from "vitest";
import { normalizePolarSession, polarList, polarRangeDateTime, polarRouteDayQuery, polarTitleInput, type PolarSport } from "./polarImport";
import { generateImportedActivityTitle } from './importedActivityTitle';

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

  it('replaces generic Polar names with a time-of-day title but keeps meaningful names', () => {
    expect(normalizePolarSession({ ...workout, name: 'TRAIL_RUNNING' }, sports, 'user-1', 'now')?.title).toBe('Morning run');
    expect(normalizePolarSession({ ...workout, name: 'A run with Sam' }, sports, 'user-1', 'now')?.title).toBe('A run with Sam');
  });

  it('uses Polar timezone offsets for local titles/dates and stores UTC start instants', () => {
    const session = { ...workout, name: 'Running', startTime: '2026-10-12T23:30:00Z', timezoneOffsetMinutes: 120 };
    expect(normalizePolarSession(session, sports, 'user-1', 'now')).toEqual(expect.objectContaining({ title: 'Night run', date: '2026-10-13', started_at: '2026-10-12T23:30:00.000Z' }));
    expect(normalizePolarSession({ ...session, startTime: '2026-10-12T06:30:00' }, sports, 'user-1', 'now')).toEqual(expect.objectContaining({ title: 'Early morning run', started_at: '2026-10-12T04:30:00.000Z' }));
  });

  it('keeps the recorded route available for locality enrichment', async () => {
    const session = { ...workout, name: 'Running', exercises: [{ routes: { route: { wayPoints: [{ latitude: 50.83, longitude: 4.43 }, { latitude: 50.84, longitude: 4.43 }] } } }] };
    const input = polarTitleInput(session, 'run', sports);
    expect(input.route).toHaveLength(2);
    expect(await generateImportedActivityTitle(input, { resolveLocality: async () => 'Woluwe-Saint-Lambert' })).toBe('Morning run Woluwe-Saint-Lambert');
  });

  it('builds one-day route queries across year boundaries', () => {
    const query = polarRouteDayQuery('2026-12-31');
    expect(Object.fromEntries(query)).toEqual({ from: '2026-12-31T00:00:00', to: '2027-01-01T00:00:00', features: 'routes' });
  });
});
