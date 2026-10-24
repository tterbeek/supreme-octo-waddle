import { describe, expect, it, vi } from "vitest";
import { buildActivityImageModel, canShareActivityImage, createPreparationGate, saveActivityImage, shareActivityImage } from "./activityImage";
import { wrapImageTitle } from "./renderActivityImage";

const base = { type: "run", title: "Morning run", date: "2026-10-17", distance_km: 10, duration_min: 65 };
const file = new File(["fixture"], "movenotes-activity.png", { type: "image/png" });

describe("activity image privacy and formatting", () => {
  it("copies only allowlisted fields, not private notes or photo credentials", () => {
    const privateActivity = { ...base, notes: "SECRET NOTE", effort: 5, feeling: "sad", user_id: "PRIVATE ID", source: "polar", route: "SECRET ROUTE", note_image_url: "https://private?token=SECRET" };
    const model = buildActivityImageModel(privateActivity, "metric");
    expect(Object.keys(model).sort()).toEqual(["date", "metrics", "source", "title", "type"]);
    expect(model).toEqual({ type: "run", title: "Morning run", date: "17 Oct 2026", metrics: ["10 km", "1h5min"], source: "polar" });
    expect(JSON.stringify(model)).not.toMatch(/SECRET|PRIVATE/);
  });
  it("includes only supported import provenance and omits manual or arbitrary sources", () => {
    expect(buildActivityImageModel({ ...base, source: "strava" }, "metric").source).toBe("strava");
    expect(buildActivityImageModel({ ...base, source: "manual" }, "metric")).not.toHaveProperty("source");
    expect(buildActivityImageModel({ ...base, source: "https://private?token=SECRET" }, "metric")).not.toHaveProperty("source");
  });
  it("uses imperial units and the user's preferred metric order", () => {
    expect(buildActivityImageModel(base, "imperial", { activity_type: "run", default_metric: "duration" }).metrics).toEqual(["1h5min", "6 mi"]);
  });
  it("omits absent, zero, nonfinite and irrelevant metrics", () => {
    expect(buildActivityImageModel({ ...base, distance_km: null, duration_min: 45 }, "metric").metrics).toEqual(["45min"]);
    expect(buildActivityImageModel({ ...base, distance_km: 7, duration_min: null }, "metric").metrics).toEqual(["7 km"]);
    expect(buildActivityImageModel({ ...base, distance_km: NaN, duration_min: -1 }, "metric").metrics).toEqual([]);
    expect(buildActivityImageModel({ ...base, type: "restore" }, "metric").metrics).toEqual([]);
  });
  it("falls back to the activity type for an empty title", () => {
    expect(buildActivityImageModel({ ...base, title: "  " }, "metric").title).toBe("Run");
    expect(buildActivityImageModel({ ...base, type: "unknown", title: null }, "metric").title).toBe("Other");
  });
  it("does not shift calendar days across timezones and rejects invalid days", () => {
    expect(buildActivityImageModel({ ...base, date: "2026-01-01" }, "metric").date).toBe("1 Jan 2026");
    expect(() => buildActivityImageModel({ ...base, date: "2026-02-31" }, "metric")).toThrow();
    expect(() => buildActivityImageModel({ ...base, date: "invalid" }, "metric")).toThrow();
  });
  it("wraps non-Latin and unbroken titles with a visible three-line limit", () => {
    const measure = (text: string) => Array.from(text).length;
    expect(wrapImageTitle("朝の散歩と静かな時間", measure, 4)).toEqual(["朝の散歩", "と静かな", "時間"]);
    const long = wrapImageTitle("a".repeat(1000), measure, 10);
    expect(long).toHaveLength(3);
    expect(long[2]).toBe("aaaaaaaaa…");
    expect(wrapImageTitle("Walk 🚶", measure, 20)).toEqual(["Walk 🚶"]);
  });
});

describe("prepared file lifecycle", () => {
  it("rejects old render results after a newer selection, retry or close", () => {
    const gate = createPreparationGate();
    const first = gate.next();
    const second = gate.next();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
    gate.cancel();
    expect(gate.isCurrent(second)).toBe(false);
  });
});

describe("file sharing", () => {
  it("shares only the prepared file, without caption or public URL", async () => {
    const nav = { canShare: vi.fn(() => true), share: vi.fn().mockResolvedValue(undefined) };
    expect(await shareActivityImage(file, nav, true)).toBe("shared");
    expect(nav.share).toHaveBeenCalledExactlyOnceWith({ files: [file] });
  });
  it("leaves cancellation quiet without a download or retry", async () => {
    const nav = { canShare: vi.fn(() => true), share: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")) };
    expect(await shareActivityImage(file, nav, true)).toBe("cancelled");
    expect(nav.share).toHaveBeenCalledTimes(1);
  });
  it("returns failure for denied sharing", async () => {
    const nav = { canShare: vi.fn(() => true), share: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")) };
    expect(await shareActivityImage(file, nav, true)).toBe("failed");
  });
  it("falls back when unsupported, insecure or policy checks throw", async () => {
    const nav = { canShare: vi.fn(() => false), share: vi.fn() };
    expect(await shareActivityImage(file, nav, true)).toBe("unsupported");
    expect(nav.share).not.toHaveBeenCalled();
    expect(canShareActivityImage(file, { ...nav, canShare: () => true }, false)).toBe(false);
    expect(canShareActivityImage(file, { ...nav, canShare: () => { throw new Error("policy"); } }, true)).toBe(false);
  });
  it("saves only the prepared PNG through an explicit download click", () => {
    const link = { href: "", download: "", target: "", rel: "", click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => link), body: { append } });
    try {
      saveActivityImage("blob:prepared-file");
      expect(link.href).toBe("blob:prepared-file");
      expect(link.download).toBe("movenotes-activity.png");
      expect(append).toHaveBeenCalledWith(link);
      expect(link.click).toHaveBeenCalledTimes(1);
      expect(link.remove).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
