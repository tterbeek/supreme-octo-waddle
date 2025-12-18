import { supabase } from "../supabaseClient";
import type { Equipment } from "../types";

export async function fetchActiveEquipment(userId: string) {
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[Equipment] Error fetching equipment:", error.message);
    return [];
  }

  return (data || []) as Equipment[];
}

export async function createEquipment(params: {
  userId: string;
  name: string;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from("equipment")
    .insert([
      {
        user_id: params.userId,
        name: params.name,
        notes: params.notes ?? null,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("[Equipment] Error creating equipment:", error.message);
    return { equipment: null, error };
  }

  return { equipment: (data as Equipment) || null, error: null };
}

export async function fetchEquipmentForActivity(activityId: string) {
  const { data, error } = await supabase
    .from("activity_equipment")
    .select(
      "equipment:equipment_id (id, user_id, name, notes, is_active, created_at)"
    )
    .eq("activity_id", activityId);

  if (error) {
    console.error("[Equipment] Error fetching activity equipment:", error.message);
    return [];
  }

  return (data || [])
    .map((item: any) => item.equipment as Equipment)
    .filter(Boolean);
}

export async function replaceActivityEquipment(
  activityId: string,
  equipmentIds: string[]
) {
  const { error: deleteError } = await supabase
    .from("activity_equipment")
    .delete()
    .eq("activity_id", activityId);

  if (deleteError) {
    console.error("[Equipment] Error clearing activity equipment:", deleteError.message);
    return { error: deleteError };
  }

  if (equipmentIds.length === 0) {
    return { error: null };
  }

  const { error } = await supabase.from("activity_equipment").insert(
    equipmentIds.map((equipmentId) => ({
      activity_id: activityId,
      equipment_id: equipmentId,
    }))
  );

  if (error) {
    console.error("[Equipment] Error linking equipment to activity:", error.message);
  }

  return { error };
}
