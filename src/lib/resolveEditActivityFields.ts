import type { ActivityField } from "../config/activityTypes";

type Activity = {
  distance_km?: number | null;
  duration_min?: number | null;
};

export function resolveEditFields(
  base: {
    defaultFields: ActivityField[];
    optionalFields: ActivityField[];
  },
  activity: Activity
): {
  defaultFields: ActivityField[];
  optionalFields: ActivityField[];
} {
  const hasDistance = activity.distance_km != null;
  const hasDuration = activity.duration_min != null;

  // If both exist, show both normally
  if (hasDistance && hasDuration) {
    return {
      defaultFields: ["distance_km", "duration_min"],
      optionalFields: [],
    };
  }

  // If only one exists, promote it to default
  if (hasDistance) {
    return {
      defaultFields: ["distance_km"],
      optionalFields: base.optionalFields.filter((f) => f !== "distance_km"),
    };
  }

  if (hasDuration) {
    return {
      defaultFields: ["duration_min"],
      optionalFields: base.optionalFields.filter((f) => f !== "duration_min"),
    };
  }

  // If no data exists yet (edge case), fall back
  return base;
}
