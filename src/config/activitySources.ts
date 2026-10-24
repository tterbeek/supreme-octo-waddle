import { IconLayersLinked } from "@tabler/icons-react";

type ActivitySourceConfig = { label: string; icon?: typeof IconLayersLinked };

export const activitySources: Record<string, ActivitySourceConfig> = {
  polar: { label: "Polar", icon: IconLayersLinked },
  strava: { label: "Strava" },
};
