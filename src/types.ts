export type Preset = {
  id: number;
  type: "run" | "ride";
  name: string;
  distance_km: number;
  duration_min: number;
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

