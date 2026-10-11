import { describe, expect, it } from "vitest";
import { resolveActivityFields } from "./resolveActivityFields";

describe("resolveActivityFields", () => {
  it("uses the configured defaults when no preference exists", () => {
    expect(resolveActivityFields("run")).toMatchObject({
      defaultFields: ["distance_km"],
      optionalFields: ["duration_min"],
    });
  });

  it("allows a user preference to override the metric order", () => {
    expect(
      resolveActivityFields("run", {
        activity_type: "run",
        default_metric: "duration",
      })
    ).toEqual({
      defaultFields: ["duration_min"],
      optionalFields: ["distance_km"],
    });
  });

  it("keeps restore activities without metric fields", () => {
    expect(
      resolveActivityFields("restore", {
        activity_type: "restore",
        default_metric: "distance",
      })
    ).toEqual({ defaultFields: [], optionalFields: [] });
  });

  it("returns an empty safe fallback for unknown activity types", () => {
    expect(resolveActivityFields("unknown")).toEqual({
      defaultFields: [],
      optionalFields: [],
    });
  });
});
