export type FeelingDuring = "sad" | "neutral" | "smile" | "happy";
export type FeelingAfter = "sad" | "smile" | "happy" | "spark";

export function mapLegacyFeeling(feeling: unknown): FeelingDuring | null {
  if (typeof feeling !== "number" || !Number.isFinite(feeling)) return null;

  switch (Math.trunc(feeling)) {
    case 1:
      return "sad";
    case 2:
      return "neutral";
    case 3:
      return "smile";
    case 4:
      return "happy";
    default:
      return null;
  }
}

export function mapFeelingDuringToLegacyValue(feeling: FeelingDuring | null): number | null {
  switch (feeling) {
    case "sad":
      return 1;
    case "neutral":
      return 2;
    case "smile":
      return 3;
    case "happy":
      return 4;
    default:
      return null;
  }
}

export function resolveFeelingState(activity: {
  feeling?: unknown;
  feeling_during?: unknown;
  feeling_after?: unknown;
}) {
  const explicitDuring =
    typeof activity.feeling_during === "string"
      ? (activity.feeling_during as FeelingDuring)
      : null;
  const legacyDuring = mapLegacyFeeling(activity.feeling);
  const during = explicitDuring ?? legacyDuring;
  const after =
    typeof activity.feeling_after === "string"
      ? (activity.feeling_after as FeelingAfter)
      : null;

  return {
    during,
    after,
    isLegacy: during != null && after == null && explicitDuring == null,
  };
}
