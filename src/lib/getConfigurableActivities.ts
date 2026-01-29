import {
  ACTIVITY_TYPES,
  METRIC_OVERRIDE_ACTIVITY_TYPE_IDS,
} from "../config/activityTypes";

export function getConfigurableActivities() {
  return METRIC_OVERRIDE_ACTIVITY_TYPE_IDS.map((id) => ACTIVITY_TYPES[id]).filter(
    (activity): activity is (typeof ACTIVITY_TYPES)[string] => Boolean(activity)
  );
}
