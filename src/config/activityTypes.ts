import type { ComponentType } from "react";

// Tabler Icons (perfect matches)
import {
  IconRun,
  IconBike,
  IconWalk,
  IconBarbell,
  IconYoga,
  IconTrekking,
  IconSwimming,
  IconDots,
} from "@tabler/icons-react";

// Lucide Icons (used for certain types if needed)
// import { Mountain, Waves, Dumbbell, StretchVertical, Sparkles } from "lucide-react";

export type ActivityField = "distance_km" | "duration_min";

export interface ActivityTypeConfig {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  defaultFields: ActivityField[];
  optionalFields: ActivityField[];
}

export const ACTIVITY_TYPES: Record<string, ActivityTypeConfig> = {
  run: {
    id: "run",
    label: "Run",
    Icon: IconRun,
    defaultFields: ["distance_km"],
    optionalFields: ["duration_min"],
  },
  ride: {
    id: "ride",
    label: "Ride",
    Icon: IconBike,
    defaultFields: ["distance_km"],
    optionalFields: ["duration_min"],
  },
  walk: {
    id: "walk",
    label: "Walk",
    Icon: IconWalk,
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  },
  strength: {
    id: "strength",
    label: "Strength",
    Icon: IconBarbell,
    defaultFields: ["duration_min"],
    optionalFields: [],
  },
  yoga: {
    id: "yoga",
    label: "Yoga",
    Icon: IconYoga,
    defaultFields: ["duration_min"],
    optionalFields: [],
  },
  hike: {
    id: "hike",
    label: "Hike",
    Icon: IconTrekking,
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  },
  swim: {
    id: "swim",
    label: "Swim",
    Icon: IconSwimming,
    // UPDATED: duration is default, distance optional
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  },
  other: {
    id: "other",
    label: "Other",
    Icon: IconDots,
    defaultFields: ["duration_min"],
    optionalFields: ["distance_km"],
  },
};
