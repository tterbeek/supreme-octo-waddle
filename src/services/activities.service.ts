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
  userId: string,
  limit: number,
  offset = 0
) {
  const { data, error } = await supabase
    .from("activities")
    .select(
      "*, activity_equipment:activity_equipment(equipment:equipment_id (id, name, notes, is_active))"
    )
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const mapped =
    data?.map((activity: any) => {
      const equipment =
        activity.activity_equipment
          ?.map((item: any) => item?.equipment)
          .filter(Boolean) || [];
      return { ...activity, equipment };
    }) || [];

  return { data: mapped, error };
}

export async function restoreActivity(activity: any) {
  const { error } = await supabase.from("activities").insert(activity);
  return { error };
}
