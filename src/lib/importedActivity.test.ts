import { describe, expect, it } from "vitest";
import { needsImportedEnrichment } from "./importedActivity";

const activity = { id: "existing-id", date: "2026-10-12", type: "run" };

describe("imported activity completion routing", () => {
  it("opens completion for pending Polar activities", () => {
    expect(needsImportedEnrichment({ ...activity, source: "polar", user_enrichment_status: "pending" })).toBe(true);
  });

  it("uses normal editing for completed imports and manual activities", () => {
    expect(needsImportedEnrichment({ ...activity, source: "polar", user_enrichment_status: "completed" })).toBe(false);
    expect(needsImportedEnrichment({ ...activity, source: "manual", user_enrichment_status: "pending" })).toBe(false);
  });

  it("opens the same completion flow for pending Strava imports", () => {
    expect(needsImportedEnrichment({ ...activity, source: "strava", external_source: "strava", user_enrichment_status: "pending" })).toBe(true);
    expect(needsImportedEnrichment({ ...activity, source: "strava", user_enrichment_status: "completed" })).toBe(false);
  });

  it("is provider-neutral", () => {
    expect(needsImportedEnrichment({ ...activity, source: "garmin", user_enrichment_status: "pending" })).toBe(true);
  });
});
