import { describe, expect, it, vi } from "vitest";
import { approximateStartPoint, generateImportedActivityBaseTitle, generateImportedActivityTitle, importedLocalDate, importedStartInstant, isGenericImportedTitle, sensibleLocality } from "./importedActivityTitle";

const route = [{ lat: 50.85, lng: 4.35 }, { lat: 50.8505, lng: 4.35 }, { lat: 50.851, lng: 4.35 }, { lat: 50.853, lng: 4.35 }];
const base = { activityType: "run", startedAt: "2026-10-23T05:30:00", providerTitle: "Running" };
describe("provider-independent imported titles", () => {
  it.each([
    ["00:00", "Night"], ["03:59", "Night"], ["04:00", "Early morning"], ["06:59", "Early morning"],
    ["07:00", "Morning"], ["11:59", "Morning"], ["12:00", "Lunchtime"], ["13:59", "Lunchtime"],
    ["14:00", "Afternoon"], ["16:59", "Afternoon"], ["17:00", "Evening"], ["23:59", "Evening"],
  ])("names the %s local bucket", (time, expected) => {
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: `2026-10-23T${time}:00` })).toBe(`${expected} run`);
  });
  it("uses IANA DST rules for real instants, offset strings/numbers, and encoded offsets when no zone exists", () => {
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-07-12T03:30:00Z", timezone: "Europe/Brussels" })).toBe("Early morning run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-01-12T03:30:00Z", timezone: "Europe/Brussels" })).toBe("Early morning run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-07-12T05:30:00Z", timezone: "Europe/Brussels" })).toBe("Morning run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-01-12T05:30:00Z", timezone: "Europe/Brussels" })).toBe("Early morning run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-10-23T22:30:00Z", timezone: 120 })).toBe("Night run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-10-23T22:30:00Z", timezone: "+02:00" })).toBe("Night run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-10-23T05:30:00+02:00" })).toBe("Early morning run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "2026-10-23T05:30:00+02:00", timezone: "Invalid/Zone" })).toBe("Early morning run");
  });
  it("does not shift naive local time twice, and aligns Polar instants/dates across midnight", () => {
    expect(generateImportedActivityBaseTitle({ ...base, timezone: 120 })).toBe("Early morning run");
    expect(importedStartInstant("2026-10-23T00:30:00", 120)).toBe("2026-10-22T22:30:00.000Z");
    expect(importedLocalDate({ ...base, startedAt: "2026-10-23T22:30:00Z", timezone: 120 })).toBe("2026-10-24");
  });
  it("does not invent a time bucket for an invalid/missing start", () => {
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: null })).toBe("Run");
    expect(generateImportedActivityBaseTitle({ ...base, startedAt: "not-a-date" })).toBe("Run");
  });
  it.each(["Run with Sam", "Morning Run", "Long run 20 km", "Brussels hills", "Race day!"])("preserves meaningful provider title %s", async providerTitle => {
    const resolveLocality = vi.fn();
    expect(await generateImportedActivityTitle({ ...base, providerTitle, route }, { resolveLocality })).toBe(providerTitle);
    expect(resolveLocality).not.toHaveBeenCalled();
  });
  it("only matches complete generic sport titles, including catalog aliases", () => {
    expect(isGenericImportedTitle({ ...base, providerTitle: "TRAIL_RUNNING" })).toBe(true);
    expect(isGenericImportedTitle({ ...base, providerTitle: "Course à pied", genericTitles: ["Course à pied"] })).toBe(true);
    expect(isGenericImportedTitle({ ...base, providerTitle: "Trail running with friends" })).toBe(false);
    expect(isGenericImportedTitle({ ...base, providerTitle: "Cycling" })).toBe(false);
  });
  it("works with future provider adapters without receiving provider-specific entities", async () => {
    expect(await generateImportedActivityTitle({ activityType: "ride", startedAt: "2026-10-23T09:30:00", providerTitle: "Cycling", route }, { resolveLocality: async () => "Oudenaarde" })).toBe("Morning ride Oudenaarde");
    expect(await generateImportedActivityTitle({ activityType: "walk", startedAt: "2026-10-23T12:30:00", providerTitle: "Walking", route }, { resolveLocality: async () => "Brussels" })).toBe("Lunchtime walk Brussels");
  });
  it("selects approximately 150m into a track, including sparse points, not the home/start", () => {
    const point = approximateStartPoint(route)!;
    expect(point.lat).toBeCloseTo(50.85135, 4);
    expect(point).not.toEqual(route[0]);
    expect(approximateStartPoint([route[0], route[3]])!.lat).toBeCloseTo(point.lat, 5);
    expect(approximateStartPoint([{ lat: NaN, lng: 4 }, ...route])).toEqual(point);
    expect(approximateStartPoint([{ lat: 0, lng: 0 }, ...route])).toEqual(point);
  });
  it("omits locality for missing, invalid, single-point and short stationary tracks", async () => {
    const resolveLocality = vi.fn(async () => "Brussels");
    for (const points of [[], [route[0]], [route[0], route[0]], [route[0], route[1]], [{ lat: 91, lng: 4 }]]) {
      expect(await generateImportedActivityTitle({ ...base, route: points }, { resolveLocality })).toBe("Early morning run");
    }
    expect(resolveLocality).not.toHaveBeenCalled();
  });
  it("uses a point 100–150m in for short-but-usable tracks", () => {
    expect(approximateStartPoint([route[0], route[2]])).toEqual(route[2]);
  });
  it("does not geocode a short loop that returns to the exact start", () => {
    expect(approximateStartPoint([route[0], { lat: 50.8506745, lng: 4.35 }, route[0]])).toBeNull();
  });
  it("gracefully omits failed/empty/address-like locality results", async () => {
    for (const result of [null, "", "123 High Street", "Rue de la Loi", "Ghent, Belgium", "50.85,4.35"]) {
      expect(await generateImportedActivityTitle({ ...base, route }, { resolveLocality: async () => result })).toBe("Early morning run");
    }
    expect(await generateImportedActivityTitle({ ...base, route }, { resolveLocality: async () => { throw Error("PRIVATE PROVIDER ERROR"); } })).toBe("Early morning run");
    expect(await generateImportedActivityTitle({ ...base, route }, { resolveLocality: async () => "Woluwe-Saint-Lambert" })).toBe("Early morning run Woluwe-Saint-Lambert");
    expect(sensibleLocality("L'Haÿ-les-Roses")).toBe("L'Haÿ-les-Roses");
  });
});
