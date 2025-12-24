import { supabase } from "../supabaseClient";

export type UpdateActivityInput = {
  id: string;
  title: string;
  distance_km: number | null;
  duration_min: number | null;
  date: string;
  feeling: number | null;
  effort: number | null;
  notes: string;
  note_image_url: string | null;
  note_thumb_image_url: string | null;
};

export async function updateActivity(input: UpdateActivityInput) {
  const { error } = await supabase
    .from("activities")
    .update({
      title: input.title,
      distance_km: input.distance_km,
      duration_min: input.duration_min,
      date: input.date,
      feeling: input.feeling,
      effort: input.effort,
      notes: input.notes,
      note_updated_at: new Date().toISOString(),
      note_image_url: input.note_image_url,
      note_thumb_image_url: input.note_thumb_image_url,
    })
    .eq("id", input.id);

  return { error };
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from("activities").delete().eq("id", id);
  return { error };
}
