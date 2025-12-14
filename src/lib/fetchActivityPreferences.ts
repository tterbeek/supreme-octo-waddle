import type { SupabaseClient } from "@supabase/supabase-js";

type MetricPreference = {
  activity_type: string;
  default_metric: "distance" | "duration";
};

export async function fetchActivityPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<MetricPreference[]> {
  const { data, error } = await supabase
    .from("activity_preferences")
    .select("activity_type, default_metric")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}
