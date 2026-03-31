import { supabase } from "../supabaseClient";

type InsertPhotoInput = {
  imagePath: string;
  thumbPath: string | null;
  sortOrder: number;
  lat?: number | null;
  lng?: number | null;
};

const toFiniteCoord = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const sanitizeCoords = (lat: unknown, lng: unknown) => {
  const safeLat = toFiniteCoord(lat);
  const safeLng = toFiniteCoord(lng);
  if (safeLat == null || safeLng == null) {
    return { lat: null, lng: null };
  }

  if (Math.abs(safeLat) < 1e-7 && Math.abs(safeLng) < 1e-7) {
    return { lat: null, lng: null };
  }

  return { lat: safeLat, lng: safeLng };
};

export async function fetchActivityPhotoCount(activityId: string) {
  const { count, error } = await supabase
    .from("activity_photos")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activityId);

  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

export async function insertActivityPhotos(
  userId: string,
  activityId: string,
  photos: InsertPhotoInput[]
) {
  if (photos.length === 0) return { error: null } as const;
  const rows = photos.map((photo) => {
    const coords = sanitizeCoords(photo.lat, photo.lng);
    return {
      user_id: userId,
      activity_id: activityId,
      image_path: photo.imagePath,
      thumb_path: photo.thumbPath,
      sort_order: photo.sortOrder,
      lat: coords.lat,
      lng: coords.lng,
    };
  });

  const { error } = await supabase.from("activity_photos").insert(rows);
  return { error } as const;
}

export async function deleteActivityPhotosByActivity(activityId: string) {
  const { data, error } = await supabase
    .from("activity_photos")
    .delete()
    .eq("activity_id", activityId)
    .select("image_path, thumb_path");

  return { data: data || [], error };
}
