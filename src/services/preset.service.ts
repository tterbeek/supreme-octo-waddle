import { supabase } from "../supabaseClient";
import type { Preset, Equipment } from "../types";
import { replacePresetEquipment } from "./equipment.service";

const mapPresetRow = (row: any): Preset => {
  const equipment: Equipment[] =
    row.preset_equipment?.map((item: any) => item?.equipment).filter(Boolean) || [];
  const equipment_ids = equipment.map((eq) => eq.id);
  return { ...row, equipment, equipment_ids };
};

export async function fetchPresets(userId: string) {
  const { data, error } = await supabase
    .from("presets")
    .select(
      "*, preset_equipment:preset_equipment(equipment:equipment_id (id, user_id, name, notes, is_active, created_at))"
    )
    .eq("user_id", userId)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[Preset] Error fetching presets:", error.message);
    return [];
  }

  return (data || []).map(mapPresetRow) as Preset[];
}

export async function fetchPreset(id: string) {
  const { data, error } = await supabase
    .from("presets")
    .select(
      "*, preset_equipment:preset_equipment(equipment:equipment_id (id, user_id, name, notes, is_active, created_at))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Preset] Error fetching preset:", error.message);
    return null;
  }

  return data ? (mapPresetRow(data) as Preset) : null;
}

export type UpsertPresetPayload = {
  user_id?: string;
  type: string;
  name: string;
  distance_km: number | null;
  duration_min: number | null;
  effort: number | null;
};

export async function createPreset(payload: UpsertPresetPayload) {
  const { data, error } = await supabase
    .from("presets")
    .insert({ ...payload, last_used_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error("[Preset] Error creating preset:", error.message);
    return { preset: null, error };
  }

  return { preset: mapPresetRow(data), error: null };
}

export async function updatePreset(id: string, payload: UpsertPresetPayload) {
  const { data, error } = await supabase
    .from("presets")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Preset] Error updating preset:", error.message);
    return { preset: null, error };
  }

  return { preset: mapPresetRow(data), error: null };
}

export async function updatePresetEquipment(presetId: string, equipmentIds: string[]) {
  return replacePresetEquipment(presetId, equipmentIds);
}
