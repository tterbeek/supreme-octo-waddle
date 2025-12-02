export type Preset = {
  id: string;
  type: string;
  name: string;
  distance_km: number | null;
  duration_min: number | null;
  effort?: number; 
};


// src/types.ts
export type Goal = {
  id: string;
  user_id: string;
  activity_type: "run" | "ride" | "any";
  metric: "distance" | "count";
  period: "week" | "month" | "year";
  target: number;
  name: string | null;
  created_at?: string;
  updated_at?: string;
};
