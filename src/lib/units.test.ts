import { describe, expect, it } from "vitest";
import {
  formatDistance,
  formatDurationMinutes,
  kmToMiles,
  milesToKm,
  roundDurationMinutes,
} from "./units";

describe("units", () => {
  it("converts kilometers and miles in both directions", () => {
    expect(kmToMiles(10)).toBeCloseTo(6.21371, 5);
    expect(milesToKm(6.21371)).toBeCloseTo(10, 4);
  });

  it("rounds valid durations and safely handles invalid values", () => {
    expect(roundDurationMinutes(12.4)).toBe(12);
    expect(roundDurationMinutes(12.6)).toBe(13);
    expect(roundDurationMinutes(0)).toBe(0);
    expect(roundDurationMinutes(-1)).toBe(0);
    expect(roundDurationMinutes(Number.NaN)).toBe(0);
  });

  it("formats distance and duration for display", () => {
    expect(formatDistance(10, "metric")).toBe("10 km");
    expect(formatDistance(10, "imperial")).toBe("6 mi");
    expect(formatDurationMinutes(45)).toBe("45min");
    expect(formatDurationMinutes(120)).toBe("2h");
    expect(formatDurationMinutes(125)).toBe("2h5min");
  });
});
