import { describe, expect, it } from "vitest";
import { buildCompanionSources, canRunWeeklyNow, COMPANION_INSTRUCTIONS, previousCompletedWeek, readCompanionOutput, type CompanionActivity } from "./companion";
import { calculateDirectionProgress } from "./companionDirectionProgress";

describe("manual weekly eligibility", () => {
  it("uses the confirmed production/dev account IDs regardless of their current email", () => {
    expect(canRunWeeklyNow({ id: '589c83df-8ee7-4319-9203-5b5c9aae0d07', email_confirmed_at: '2026-01-01' })).toBe(true);
    expect(canRunWeeklyNow({ id: '7725b4a2-16df-47dd-bae0-c7695717a342', email_confirmed_at: '2026-01-01' })).toBe(true);
    expect(canRunWeeklyNow({ id: 'another-user', email_confirmed_at: '2026-01-01' })).toBe(false);
    expect(canRunWeeklyNow({ id: '589c83df-8ee7-4319-9203-5b5c9aae0d07' })).toBe(false);
    expect(canRunWeeklyNow({})).toBe(false);
  });
});

describe("completed weekly context", () => {
  it("keeps Sunday in the current week and switches at the user's Monday midnight", () => {
    const instant = new Date("2026-10-18T22:30:00Z");
    expect(previousCompletedWeek(instant, "Europe/Brussels")).toEqual({ start: "2026-10-12", end: "2026-10-18" });
    expect(previousCompletedWeek(instant, "America/New_York")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
  });
  it("handles year and daylight-saving boundaries as calendar weeks", () => {
    expect(previousCompletedWeek(new Date("2026-01-01T12:00:00Z"))).toEqual({ start: "2025-12-22", end: "2025-12-28" });
    expect(previousCompletedWeek(new Date("2026-10-26T00:30:00Z"), "Europe/Brussels")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });
  const activity: CompanionActivity = { type: "walk", title: "Lunch walk", date: "2026-10-13", duration_min: 20, distance_km: 2, feeling_after: "good", feeling_during: null, notes: "PRIVATE ACTIVITY NOTE" };
  it("excludes every activity-note excerpt from model input and provenance unless permitted", () => {
    const base = { goals: [], tweak: "Start gently", lastReflection: "I enjoyed it", activities: [activity], allowNotes: false };
    expect(JSON.stringify(buildCompanionSources(base))).not.toContain(activity.notes);
    expect(JSON.stringify(buildCompanionSources({ ...base, allowNotes: true }))).toContain(activity.notes);
    expect(JSON.stringify(buildCompanionSources(base))).toContain("I enjoyed it");
  });
  it("bounds free text and activities before sending provider context", () => {
    const sources = buildCompanionSources({ goals: [], tweak: null, lastReflection: null, activities: Array.from({ length: 205 }, () => ({ ...activity, notes: "x".repeat(5000) })), allowNotes: true, activityLimitReached: true });
    expect(sources.filter((source) => source.kind === "activity")).toHaveLength(200);
    expect(JSON.stringify(sources).length).toBeLessThan(60000);
    expect(sources[0].detail).toContain("limited to");
  });
  it("includes only the person's Companion reflection as a distinct source, even without activity-note permission", () => {
    const sources = buildCompanionSources({ goals: [], tweak: null, lastReflection: null, activities: [activity], allowNotes: false,
      companionReflections: [{ week_start: "2026-10-05", user_reflection: "I actually wanted a little more challenge." }],
    });
    expect(sources.find(source => source.kind === "companion_reflection")).toEqual({
      kind: "companion_reflection", label: "Your Companion reflection · week of 2026-10-05", detail: "I actually wanted a little more challenge.",
    });
    expect(JSON.stringify(sources)).not.toContain(activity.notes);
    expect(sources.filter(source => source.kind === "tweak_reflection")).toHaveLength(0);
  });
  it("bounds Companion reflections to three 1000-character excerpts and omits removed/blank responses", () => {
    const sources = buildCompanionSources({ goals: [], tweak: null, lastReflection: null, activities: [], allowNotes: false,
      companionReflections: [{ week_start: "2026-10-12", user_reflection: null }, { week_start: "2026-10-05", user_reflection: "  " },
        ...Array.from({ length: 5 }, (_, i) => ({ week_start: `2026-09-${20 - i}`, user_reflection: "x".repeat(4000) }))],
    });
    const reflections = sources.filter(source => source.kind === "companion_reflection");
    expect(reflections).toHaveLength(3);
    expect(reflections.every(source => source.detail.length < 1020 && source.detail.endsWith("[excerpt]"))).toBe(true);
  });
  it("works unchanged without prior Companion reflections", () => {
    const base = { goals: [], tweak: null, lastReflection: null, activities: [], allowNotes: false };
    expect(buildCompanionSources(base)).toEqual(buildCompanionSources({ ...base, companionReflections: [] }));
  });
  it("attaches calculated Direction values as structured context and readable provenance", () => {
    const goals = [{ activity_type: "run", metric: "distance", period: "year", target: 1000, name: "My long-term goal" }];
    const directionProgress = calculateDirectionProgress(goals, [{ type: "run", date: "2026-01-01", distance_km: 600, duration_min: null }], "2026-10-18");
    const sources = buildCompanionSources({ goals, activities: [], tweak: null, lastReflection: null, allowNotes: false, directionProgress });
    expect(sources[0].progress).toMatchObject({ actual: 600, remaining: 400, target: 1000, as_of: "2026-10-18" });
    expect(sources[0].detail).toContain("600 / 1000 km");
    expect(sources[0].detail).toContain("400 km remaining");
    expect(sources[0].detail).toContain("as of 2026-10-18");
  });
});

describe("provider output", () => {
  it("requests two paragraphs and selective grounded progress without pressure or compulsory tweak endorsement", () => {
    expect(COMPANION_INSTRUCTIONS).toContain("two short paragraphs, separated by a blank line");
    expect(COMPANION_INSTRUCTIONS).toContain("Use only supplied, calculated progress");
    expect(COMPANION_INSTRUCTIONS).toContain("especially when they have explicitly said that goal matters to them");
    expect(COMPANION_INSTRUCTIONS).toContain("Do not suggest increasing targets or compensating for shortfalls");
    expect(COMPANION_INSTRUCTIONS).toContain("do not automatically argue for keeping it");
    expect(COMPANION_INSTRUCTIONS).not.toContain("durations, target progress");
  });
  it("preserves the provider's blank line between paragraphs", () => {
    const text = "One main thought.\n\nAn optional question?";
    expect(readCompanionOutput({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] })).toBe(text);
  });
  it("reads text after reasoning items rather than assuming output[0] contains the answer", () => {
    expect(readCompanionOutput({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "A small thought." }] }] })).toBe("A small thought.");
  });
  it("does not publish refusals, truncated responses or excessive output as a weekly post", () => {
    expect(() => readCompanionOutput({ status: "incomplete", output: [] })).toThrow();
    expect(() => readCompanionOutput({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] })).toThrow();
    expect(() => readCompanionOutput({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "x".repeat(2001) }] }] })).toThrow();
  });
});
