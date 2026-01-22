import type { ComponentType } from "react";

// Tabler Icons (perfect matches)
import {
  IconRun,
  IconBike,
  IconWalk,
  IconBarbell,
  IconTrekking,
  IconSwimming,
  IconDots,
  IconSparkles,
  IconPlant2,
  IconZzz,
} from "@tabler/icons-react";

// Lucide Icons (used for certain types if needed)
// import { Mountain, Waves, Dumbbell, StretchVertical, Sparkles } from "lucide-react";

export type ActivityField = "distance_km" | "duration_min";

export interface ActivityTypeConfig {
  id: string;
  label: string;
  equipmentLabel?: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  defaultFields: ActivityField[];
  optionalFields: ActivityField[];
}

export const ACTIVITY_TYPES: Record<string, ActivityTypeConfig> = {
  any: {
    id: "any",
    label: "All Activities",
    equipmentLabel: "All activities",
    Icon: IconSparkles,
    defaultFields: [],
    optionalFields: [],
  },
  run: {
    id: "run",
    label: "Run",
    equipmentLabel: "Running",
    Icon: IconRun,
    defaultFields: ["distance_km"],
    optionalFields: ["duration_min"],
  },
  ride: {
    id: "ride",
    label: "Ride",
    equipmentLabel: "Riding",
    Icon: IconBike,
    defaultFields: ["distance_km"],
    optionalFields: ["duration_min"],
  },
  walk: {
    id: "walk",
    label: "Walk",
    equipmentLabel: "Walking",
    Icon: IconWalk,
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  },
  strength: {
    id: "strength",
    label: "Strength",
    equipmentLabel: "Strength",
    Icon: IconBarbell,
    defaultFields: ["duration_min"],
    optionalFields: [],
  },
  yoga: {
    id: "yoga",
    label: "Yoga",
    equipmentLabel: "Yoga",
    Icon: IconPlant2,
    defaultFields: ["duration_min"],
    optionalFields: [],
  },
  hike: {
    id: "hike",
    label: "Hike",
    equipmentLabel: "Hiking",
    Icon: IconTrekking,
    defaultFields: ["distance_km"],
    optionalFields: ["duration_min"],
  },
  swim: {
    id: "swim",
    label: "Swim",
    equipmentLabel: "Swimming",
    Icon: IconSwimming,
    // UPDATED: duration is default, distance optional
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  },
    restore: {
    id: "restore",
    label: "Restore",
    equipmentLabel: "Restore",
    Icon: IconZzz,
    defaultFields: [],
    optionalFields: [],
  },
  other: {
    id: "other",
    label: "Other",
    equipmentLabel: "Other",
    Icon: IconDots,
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  },
};
