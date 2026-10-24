import { supabase } from "../supabaseClient";
import { buildActivityImageModel } from "../lib/activityImage";
import { getActivityPhotos } from "../lib/photos";
import { normalizeStoragePath, NOTE_STORAGE_BUCKET, LEGACY_NOTE_STORAGE_BUCKET } from "./storage.service";
import type { UnitSystem } from "../lib/units";

export async function loadOwnedActivityImage(activityId: string, units: UnitSystem) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in to share your activity.");
  const userId = auth.user.id;
  const { data: activity, error } = await supabase.from("activities")
    .select("type, title, date, source, distance_km, duration_min, note_image_url, note_thumb_image_url")
    .eq("id", activityId).eq("user_id", userId).single();
  if (error || !activity) throw new Error("Couldn't load your activity. Try again.");
  const [photos, preferences] = await Promise.all([
    supabase.from("activity_photos").select("id, image_path, thumb_path, sort_order, created_at")
      .eq("activity_id", activityId).eq("user_id", userId),
    supabase.from("activity_preferences").select("activity_type, default_metric")
      .eq("user_id", userId).eq("activity_type", activity.type).maybeSingle(),
  ]);
  if (photos.error || preferences.error) throw new Error("Couldn't load activity details. Try again.");
  const preference = preferences.data;
  return {
    model: buildActivityImageModel(activity, units, preference && (preference.default_metric === "distance" || preference.default_metric === "duration")
      ? { activity_type: preference.activity_type, default_metric: preference.default_metric } : undefined),
    photos: getActivityPhotos({ ...activity, id: activityId, photos: photos.data }),
  };
}

/** Authenticated private storage download. Storage URLs never reach the renderer. */
export async function loadActivityImagePhoto(rawPath: string): Promise<Blob> {
  const path = normalizeStoragePath(rawPath);
  if (!path) throw new Error("Couldn't load this photo.");
  for (const bucket of [NOTE_STORAGE_BUCKET, LEGACY_NOTE_STORAGE_BUCKET]) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (!error && data) return data;
  }
  throw new Error("Couldn't load this photo. Retry or choose No photo.");
}
