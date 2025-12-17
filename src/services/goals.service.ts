import { supabase } from "../supabaseClient";
import type { Goal } from "../types";

const GOAL_RPC = "stats_goal_progress";

export async function fetchGoals(userId: string) {
  const { data, error } = await supabase
    .from("goals")
    .select("id, activity_type, metric, period, target, name, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return { data: (data as Goal[]) || [], error };
}

export async function fetchGoalPreferences(userId: string) {
  const { data, error } = await supabase
    .from("goal_preferences")
    .select("goal_id")
    .eq("user_id", userId);

  return { data: data || [], error };
}

export async function fetchGoalStats(userId: string) {
  const { data, error } = await supabase.rpc(GOAL_RPC, { user_id: userId });
  return { data: (data as any[]) || [], error };
}
