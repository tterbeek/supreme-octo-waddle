import { describe, expect, it } from "vitest";
import {
  mapFeelingDuringToLegacyValue,
  mapLegacyFeeling,
  resolveFeelingState,
} from "./feelings";

describe("feelings", () => {
  it("maps legacy numeric feelings to the current labels", () => {
    expect(mapLegacyFeeling(1)).toBe("sad");
    expect(mapLegacyFeeling(2)).toBe("neutral");
    expect(mapLegacyFeeling(3)).toBe("smile");
    expect(mapLegacyFeeling(4)).toBe("happy");
    expect(mapLegacyFeeling(5)).toBeNull();
  });

  it("maps current during feelings back to legacy values", () => {
    expect(mapFeelingDuringToLegacyValue("sad")).toBe(1);
    expect(mapFeelingDuringToLegacyValue("neutral")).toBe(2);
    expect(mapFeelingDuringToLegacyValue("smile")).toBe(3);
    expect(mapFeelingDuringToLegacyValue("happy")).toBe(4);
    expect(mapFeelingDuringToLegacyValue(null)).toBeNull();
  });

  it("prefers explicit feeling phases over the legacy field", () => {
    expect(
      resolveFeelingState({
        feeling: 1,
        feeling_during: "happy",
        feeling_after: "spark",
      })
    ).toEqual({ during: "happy", after: "spark", isLegacy: false });
  });

  it("identifies legacy-only feeling data", () => {
    expect(resolveFeelingState({ feeling: 3 })).toEqual({
      during: "smile",
      after: null,
      isLegacy: true,
    });
  });
});
