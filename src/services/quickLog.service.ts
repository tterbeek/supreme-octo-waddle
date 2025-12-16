import { supabase } from "../supabaseClient";
import type { Preset } from "../types";

export async function fetchActivityPreference(
  userId: string,
  activityType: string
) {
  const { data, error } = await supabase
    .from("activity_preferences")
    .select("activity_type, default_metric")
    .eq("user_id", userId)
    .eq("activity_type", activityType)
    .maybeSingle();

  if (error) {
    console.error("[QuickLog] Error fetching activity preference:", error.message);
    return undefined;
  }

  return data ?? undefined;
}

export async function fetchPresets(userId: string) {
  const { data, error } = await supabase
    .from("presets")
    .select("*")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false });

  if (error) {
    console.error("[QuickLog] Error fetching presets:", error.message);
    return [];
  }

  return (data || []) as Preset[];
}

export type SaveQuickLogInput = {
  userId: string;
  activityType: string;
  date: string;
  distanceValue: number | null;
  durationValue: number | null;
  effortValue: number | null;
  feelingValue: number | null;
  title: string;
};

export async function saveQuickLog(input: SaveQuickLogInput) {
  const { data, error } = await supabase
    .from("activities")
    .insert([
      {
        user_id: input.userId,
        type: input.activityType,
        date: input.date,
        distance_km: input.distanceValue,
        duration_min: input.durationValue,
        effort: input.effortValue,
        feeling: input.feelingValue,
        title: input.title,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("[QuickLog] Error saving activity:", error.message);
    return { id: null, error };
  }

  return { id: data?.id ?? null, error: null };
}

export async function createPresetFromActivity(params: {
  userId: string;
  activityType: string;
  name: string;
  distanceValue: number | null;
  durationValue: number | null;
  effortValue: number | null;
}) {
  const { error } = await supabase.from("presets").insert([
    {
      user_id: params.userId,
      type: params.activityType,
      name: params.name,
      distance_km: params.distanceValue,
      duration_min: params.durationValue,
      effort: params.effortValue,
    },
  ]);

  if (error) {
    console.error("[QuickLog] Error saving preset:", error.message);
    return { error };
  }

  return { error: null };
}

export async function updatePresetLastUsed(presetId: string) {
  const { error } = await supabase
    .from("presets")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", presetId);

  if (error) {
    console.error("[QuickLog] Error updating preset last_used_at:", error.message);
  }

  return { error };
}
