// src/components/GoalProgressCard.tsx
import type { Goal } from "../types";
import { computeGoalProgress } from "../lib/goalEngine";
import { Bike, Footprints, Target, Hash } from "lucide-react";

interface Props {
  goal: Goal;
  activities: {
    type: "run" | "ride";
    distance_km: number;
    date: string | Date;
    // other fields are fine, they'll be ignored by computeGoalProgress
  }[];
  compact?: boolean;
}

export default function GoalProgressCard({ goal, activities, compact }: Props) {
  const { currentValue, target, unit, ratio } = computeGoalProgress(
    goal,
    activities
  );

  const ActivityIcon =
    goal.activity_type === "run"
      ? Footprints
      : goal.activity_type === "ride"
      ? Bike
      : Target;

  const MetricIcon = goal.metric === "distance" ? Target : Hash;

  return (
    <div
      className={`rounded-xl bg-warm-100 border border-warm-200 shadow-sm ${
        compact ? "px-3 py-2" : "p-4"
      }`}
    >
      {/* HEADER — always shown, just a bit tighter in compact mode */}
      <div
        className={`flex items-center gap-2 ${
          compact ? "mb-1" : "mb-2"
        }`}
      >
        <ActivityIcon
          className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-gray-900`}
        />
        <MetricIcon
          className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-gray-500`}
        />
        <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
          {goal.name || `${goal.activity_type} ${goal.metric}`}
        </h3>
      </div>

      {/* VALUE — already rounded by computeGoalProgress */}
      <div className="text-base text-gray-900 font-medium">
        {currentValue} / {target} {unit}
      </div>

      {/* DOTS */}
      <div className="flex gap-1 mt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < Math.floor(ratio * 5)
                ? "bg-movenotes-accent"
                : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
