import { ACTIVITY_TYPES } from "../config/activityTypes";

export function getConfigurableActivities() {
  return Object.values(ACTIVITY_TYPES).filter(
    (activity) =>
      activity.defaultFields.length === 1 && activity.optionalFields.length === 1
  );
}
