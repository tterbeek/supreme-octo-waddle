import { ACTIVITY_TYPES } from "../config/activityTypes";
import type { ActivityField } from "../config/activityTypes";

type Metric = "distance" | "duration";

export type ActivityPreference = {
  activity_type: string;
  default_metric: Metric;
};

export function resolveActivityFields(
  activityType: string,
  preference?: ActivityPreference
): {
  defaultFields: ActivityField[];
  optionalFields: ActivityField[];
} {
  const config = ACTIVITY_TYPES[activityType];

  // Safety fallback
  if (!config) {
    return { defaultFields: [], optionalFields: [] };
  }

  // No preference → system defaults
  if (!preference) {
    return config;
  }

  // Restore ignores preferences
  if (activityType === "restore") {
    return { defaultFields: [], optionalFields: [] };
  }

  // Preference override
  if (preference.default_metric === "distance") {
    return {
      defaultFields: ["distance_km"],
      optionalFields: ["duration_min"],
    };
  }

  return {
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  };
}
