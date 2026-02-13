import { supabase } from "../supabaseClient";

type InsertPhotoInput = {
  imagePath: string;
  thumbPath: string | null;
  sortOrder: number;
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
  const rows = photos.map((photo) => ({
    user_id: userId,
    activity_id: activityId,
    image_path: photo.imagePath,
    thumb_path: photo.thumbPath,
    sort_order: photo.sortOrder,
  }));

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
