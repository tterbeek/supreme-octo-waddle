import { supabase } from "../supabaseClient";
import { getCurrentUser } from "./auth.service";
import { refreshSharedActivity } from "./circle.service";

export type ActivityLocationTag = {
  activity_id: string;
  type: "location";
  value: string;
  metadata: {
    lat?: number;
    lng?: number;
  } | null;
  source: string | null;
};

export type ActivityLocationUpdatedDetail = {
  activityId: string;
  locationTag: ActivityLocationTag | null;
};

export const ACTIVITY_LOCATION_UPDATED_EVENT =
  "movenotes:activity-location-updated";

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const normalizeLocationTag = (row: any): ActivityLocationTag | null => {
  if (!row?.activity_id || typeof row.value !== "string" || !row.value.trim()) {
    return null;
  }

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? {
          lat: toFiniteNumber(row.metadata.lat),
          lng: toFiniteNumber(row.metadata.lng),
        }
      : null;

  return {
    activity_id: String(row.activity_id),
    type: "location",
    value: row.value.trim(),
    metadata,
    source: typeof row.source === "string" ? row.source : null,
  };
};

const emitLocationUpdate = (detail: ActivityLocationUpdatedDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ActivityLocationUpdatedDetail>(
      ACTIVITY_LOCATION_UPDATED_EVENT,
      { detail }
    )
  );
};

export const applyLocationTagToActivity = <T extends { id: string }>(
  activity: T,
  locationTag: ActivityLocationTag | null
) => ({
  ...activity,
  locationTag,
});

export async function attachLocationTagsToActivities<T extends { id: string }>(
  activities: T[]
): Promise<Array<T & { locationTag: ActivityLocationTag | null }>> {
  const ids = Array.from(
    new Set(
      activities
        .map((activity) => activity?.id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  if (ids.length === 0) {
    return activities.map((activity) => applyLocationTagToActivity(activity, null));
  }

  const { data, error } = await supabase
    .from("activity_tags")
    .select("activity_id, type, value, metadata, source")
    .eq("type", "location")
    .in("activity_id", ids);

  if (error) {
    console.error("[ActivityLocation] Error fetching location tags:", error.message);
    return activities.map((activity) => applyLocationTagToActivity(activity, null));
  }

  const byActivityId = new Map<string, ActivityLocationTag>();
  for (const row of data || []) {
    const tag = normalizeLocationTag(row);
    if (!tag) continue;
    byActivityId.set(tag.activity_id, tag);
  }

  return activities.map((activity) =>
    applyLocationTagToActivity(activity, byActivityId.get(activity.id) ?? null)
  );
}

export async function resolveActivityLocationTag(activityId: string) {
  const { data, error } = await supabase.functions.invoke(
    "resolve-activity-location",
    {
      body: { activityId },
    }
  );

  if (error) {
    console.warn(
      "[ActivityLocation] Could not resolve location tag:",
      error.message || error
    );
    return { locationTag: null, error };
  }

  if (data?.updated === false) {
    return { locationTag: null, error: null };
  }

  const locationTag = normalizeLocationTag(data?.tag) ?? null;
  const user = await getCurrentUser();
  if (user) {
    try {
      await refreshSharedActivity(activityId, user.id);
    } catch (refreshErr: any) {
      console.warn(
        "[ActivityLocation] Could not refresh shared Circle activity:",
        refreshErr?.message || refreshErr
      );
    }
  }
  emitLocationUpdate({ activityId, locationTag });
  return { locationTag, error: null };
}
