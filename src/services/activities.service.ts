import { supabase } from "../supabaseClient";

export async function fetchActivitiesForGoals(userId: string, cutoffStr: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("id, user_id, type, date, distance_km, feeling, effort")
    .eq("user_id", userId)
    .gte("date", cutoffStr)
    .order("date", { ascending: false });

  return { data: data || [], error };
}

export async function fetchFeedPage(
  limit: number,
  offset = 0
) {
  const { data, error } = await supabase.rpc("get_journal_feed_page_v2", {
    p_limit: limit,
    p_offset: offset,
  });

  return { data: data || [], error };
}

export async function restoreActivity(activity: any) {
  const { error } = await supabase.from("activities").insert(activity);
  return { error };
}

export async function updateActivityFeeling(activityId: string, feeling: number) {
  const { error } = await supabase
    .from("activities")
    .update({
      feeling,
      note_updated_at: new Date().toISOString(),
    })
    .eq("id", activityId);
  return { error };
}

export async function updateActivityEffort(activityId: string, effort: number) {
  const { error } = await supabase
    .from("activities")
    .update({
      effort,
      note_updated_at: new Date().toISOString(),
    })
    .eq("id", activityId);
  return { error };
}
