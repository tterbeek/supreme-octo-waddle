import { describe, expect, it, vi } from "vitest";
import type { CompanionGoal } from "./companion";
import { calculateDirectionProgress, directionPeriodRange, loadDirectionProgress, type DirectionActivity } from "./companionDirectionProgress";

const goal = (period: string, metric = "distance", target = 20, activity_type = "run"): CompanionGoal => ({ activity_type, metric, period, target, name: null });
const activity = (date: string, distance_km: number | null, type = "run", duration_min: number | null = 30): DirectionActivity => ({ type, date, distance_km, duration_min });

describe("Direction progress as of the reflected Sunday", () => {
  const asOf = "2026-10-18";
  it("supplies the requested weekly distance without rounding to whole kilometres or counting the next week", () => {
    const [result] = calculateDirectionProgress([goal("week")], [activity("2026-10-11", 99), activity("2026-10-12", 10.1), activity("2026-10-18", 20.3), activity("2026-10-19", 100), activity("2026-10-18", 42, "ride")], asOf);
    expect(result).toEqual({ activity_type: "run", metric: "distance", unit: "km", period: "week", period_start: "2026-10-12", period_end: asOf, target: 20, actual: 30.4, remaining: 0, as_of: asOf });
    expect(result).not.toHaveProperty("on_track");
  });
  it("accumulates monthly/yearly progress from their calendar starts through the same Sunday", () => {
    const rows = [activity("2025-12-31", 100), activity("2026-01-01", 200), activity("2026-09-30", 250), activity("2026-10-01", 5), activity("2026-10-12", 10.1), activity("2026-10-18", 20.3), activity("2026-10-19", 500)];
    const [month, year] = calculateDirectionProgress([goal("month", "distance", 100), goal("year", "distance", 1000)], rows, asOf);
    expect(month).toMatchObject({ period_start: "2026-10-01", period_end: "2026-10-31", actual: 35.4, remaining: 64.6, as_of: asOf });
    expect(year).toMatchObject({ period_start: "2026-01-01", period_end: "2026-12-31", actual: 485.4, remaining: 514.6, as_of: asOf });
  });
  it("supports duration, count and any-activity Directions, with null metric values handled like the existing stats", () => {
    const rows = [activity("2026-10-12", null, "run", 25.5), activity("2026-10-18", 2, "walk", null)];
    const [duration, count, distance] = calculateDirectionProgress([goal("week", "duration", 60, "any"), goal("week", "count", 4, "any"), goal("week", "distance", 20)], rows, asOf);
    expect(duration).toMatchObject({ unit: "min", actual: 25.5, remaining: 34.5 });
    expect(count).toMatchObject({ unit: "activities", actual: 2, remaining: 2 });
    expect(distance).toMatchObject({ actual: 0, remaining: 20 });
  });
  it("uses Monday–Sunday across year boundaries and leap-month calendar ends", () => {
    expect(directionPeriodRange("week", "2027-01-03")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
    expect(directionPeriodRange("month", "2028-02-20")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    const [week, year] = calculateDirectionProgress([goal("week"), goal("year")], [activity("2026-12-31", 10), activity("2027-01-01", 2)], "2027-01-03");
    expect(week.actual).toBe(12); expect(year.actual).toBe(2);
  });
  it("returns zero rather than missing progress when nothing was logged, including zero targets", () => {
    expect(calculateDirectionProgress([goal("week", "distance", 0)], [], asOf)[0]).toMatchObject({ target: 0, actual: 0, remaining: 0 });
  });
  it("rejects invalid cutoffs/unsupported periods rather than supplying misleading totals", () => {
    expect(() => directionPeriodRange("month", "2026-02-30")).toThrow();
    expect(() => directionPeriodRange("forever", asOf)).toThrow();
  });
});

describe("complete historical progress reads", () => {
  it("reads all numeric activity pages, not just the 200-detail or 1000-row API limit", async () => {
    const rows = Array.from({ length: 1002 }, () => activity("2026-05-01", 1));
    const read = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({ data: rows.slice(offset, offset + limit), error: null }));
    const result = await loadDirectionProgress([goal("year", "distance", 2000)], "2026-10-18", read);
    expect(result[0]).toMatchObject({ actual: 1002, remaining: 998 });
    expect(read).toHaveBeenCalledTimes(3);
    expect(read).toHaveBeenNthCalledWith(1, { start: "2026-01-01", end: "2026-10-18", offset: 0, limit: 500 });
    expect(read).toHaveBeenNthCalledWith(3, { start: "2026-01-01", end: "2026-10-18", offset: 1000, limit: 500 });
  });
  it("uses the earliest required calendar start, including a cross-year week", async () => {
    const read = vi.fn(async () => ({ data: [], error: null }));
    await loadDirectionProgress([goal("week"), goal("year")], "2027-01-03", read);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ start: "2026-12-28", end: "2027-01-03" }));
  });
  it("does not read historical activity data without Directions", async () => {
    const read = vi.fn();
    expect(await loadDirectionProgress([], "2026-10-18", read)).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
  it("fails instead of publishing partial totals if a subsequent page cannot be read", async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => activity("2026-01-01", 1)), error: null })
      .mockResolvedValueOnce({ data: null, error: "PRIVATE DATABASE ERROR" });
    await expect(loadDirectionProgress([goal("year")], "2026-10-18", read)).rejects.toThrow("Couldn't calculate Direction progress.");
  });
});
