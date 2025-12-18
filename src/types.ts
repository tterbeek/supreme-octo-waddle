export type Preset = {
  id: string;
  type: string;
  name: string;
  distance_km: number | null;
  duration_min: number | null;
  effort?: number; 
  equipment_ids?: string[];
  equipment?: Equipment[];
  preset_equipment?: { equipment: Equipment }[];
};

export type Equipment = {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
};


// src/types.ts
export type Goal = {
  id: string;
  user_id: string;
  activity_type:
    | "run"
    | "ride"
    | "walk"
    | "strength"
    | "yoga"
    | "hike"
    | "swim"
    | "other"
    | "any";
  metric: "distance" | "duration" | "count";
  period: "week" | "month" | "year";
  target: number;
  name: string | null;
  created_at?: string;
  updated_at?: string;
};
