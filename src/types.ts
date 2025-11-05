export type Preset = {
  id: number;
  type: "run" | "ride";
  name: string;
  distance_km: number;
  duration_min: number;
};
