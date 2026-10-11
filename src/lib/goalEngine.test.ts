import { describe, expect, it } from "vitest";
import type { Goal } from "../types";
import {
  computeGoalComparison,
  computeGoalProgress,
  getActivitiesForGoalPeriod,
} from "./goalEngine";

const makeGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: "goal-1",
  user_id: "user-1",
  activity_type: "run",
  metric: "distance",
  period: "month",
  target: 100,
  name: "Monthly running",
  ...overrides,
});

describe("goalEngine", () => {
  it("filters activities to the current goal period", () => {
    const activities = [
      { type: "run" as const, distance_km: 10, date: "2026-04-05" },
      { type: "ride" as const, distance_km: 20, date: "2026-04-10" },
      { type: "run" as const, distance_km: 30, date: "2026-03-31" },
    ];

    expect(
      getActivitiesForGoalPeriod(activities, makeGoal(), new Date("2026-04-15"))
    ).toEqual([activities[0], activities[1]]);
  });

  it("computes capped distance progress", () => {
    const activities = [
      { type: "run" as const, distance_km: 60, date: "2026-04-05" },
      { type: "run" as const, distance_km: 55, date: "2026-04-10" },
    ];

    expect(
      computeGoalProgress(makeGoal(), activities, new Date("2026-04-15"))
    ).toMatchObject({
      currentValue: 115,
      target: 100,
      unit: "km",
      ratio: 1,
    });
  });

  it("returns period-over-period distance comparison", () => {
    const activities = [
      { type: "run" as const, distance_km: 30, date: "2026-03-10" },
      { type: "run" as const, distance_km: 45, date: "2026-02-10" },
    ];

    expect(
      computeGoalComparison(makeGoal(), activities, new Date("2026-04-15"))
    ).toBe(-33);
  });

  it("returns null when there is no comparison baseline", () => {
    expect(
      computeGoalComparison(
        makeGoal(),
        [{ type: "run", distance_km: 10, date: "2026-03-10" }],
        new Date("2026-04-15")
      )
    ).toBeNull();
  });
});
