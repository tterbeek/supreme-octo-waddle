import { supabase } from "../supabaseClient";
import type { Preset } from "../types";
import { replaceActivityEquipment } from "./equipment.service";
import type { FeelingAfter, FeelingDuring } from "../lib/feelings";

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

const mapPresetRow = (row: any) => {
  const equipment =
    row.preset_equipment?.map((item: any) => item?.equipment).filter(Boolean) || [];
  const equipment_ids = equipment.map((eq: any) => eq.id);
  return { ...row, equipment, equipment_ids } as Preset;
};

export async function fetchPresets(userId: string) {
  const { data, error } = await supabase
    .from("presets")
    .select(
      "*, preset_equipment:preset_equipment(equipment:equipment_id (id, user_id, name, notes, is_active, created_at))"
    )
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false });

  if (error) {
    console.error("[QuickLog] Error fetching presets:", error.message);
    return [];
  }

  return (data || []).map(mapPresetRow);
}

export type SaveQuickLogInput = {
  userId: string;
  activityType: string;
  date: string;
  distanceValue: number | null;
  durationValue: number | null;
  effortValue: number | null;
  feelingDuringValue: FeelingDuring | null;
  feelingAfterValue: FeelingAfter | null;
  title: string;
  equipmentIds: string[];
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
        feeling_during: input.feelingDuringValue,
        feeling_after: input.feelingAfterValue,
        title: input.title,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("[QuickLog] Error saving activity:", error.message);
    return { id: null, error };
  }

  const activityId = data?.id ?? null;

  if (activityId && input.equipmentIds.length > 0) {
    const { error: linkError } = await replaceActivityEquipment(
      activityId,
      input.equipmentIds
    );
    if (linkError) {
      console.error(
        "[QuickLog] Error linking equipment to activity:",
        linkError.message
      );
      return { id: activityId, error: linkError };
    }
  }

  return { id: activityId, error: null };
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
      last_used_at: new Date().toISOString(),
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
