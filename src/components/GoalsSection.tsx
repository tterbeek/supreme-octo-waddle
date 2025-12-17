import GoalProgressCard from "./GoalProgressCard";
import type { Goal } from "../types";
import { useNavigate } from "react-router-dom";

type GoalStat = {
  goal_id: string;
  name: string | null;
  activity_type: Goal["activity_type"] | "any";
  metric: "distance" | "duration" | "count";
  period: "week" | "month" | "year";
  target: number;
  current_value: number;
  unit: "km" | "activities" | "min";
  progress_ratio: number;
  comparison_pct: number | null;
};

type GoalsSectionProps = {
  goals: Goal[];
  goalStats: GoalStat[];
  selectedGoals: string[];
  useRpcGoals: boolean;
  activitiesForGoals: any[];
};

export default function GoalsSection({
  goals,
  goalStats,
  selectedGoals,
  useRpcGoals,
  activitiesForGoals,
}: GoalsSectionProps) {
  const navigate = useNavigate();

  const homeGoals = goals
    .filter((g) => selectedGoals.includes(g.id))
    .slice(0, 3);

  const homeGoalStats = goalStats
    .filter((g) => selectedGoals.includes(g.goal_id))
    .slice(0, 3);

  const showGoalSection = useRpcGoals
    ? homeGoalStats.length > 0
    : homeGoals.length > 0;

  const displayedGoalStats = homeGoalStats.slice(0, 2);
  const displayedLegacyGoals = homeGoals.slice(0, 2);
  const displayedCount = useRpcGoals
    ? displayedGoalStats.length
    : displayedLegacyGoals.length;

  const goalGridClass =
    displayedCount === 1
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 sm:grid-cols-2 gap-3";

  if (!showGoalSection) return null;

  return (
    <>
      <h2 className="text-sm font-medium text-gray-500 mb-2 mt-4">
        Your Progress
      </h2>
      <div
        className="mb-4"
        onClick={() => navigate(useRpcGoals ? "/stats" : "/stats-legacy")}
      >
        <div className={goalGridClass}>
          {useRpcGoals
            ? displayedGoalStats.map((g) => (
                <GoalProgressCard
                  key={g.goal_id}
                  goal={{ ...g, progress_current: g.current_value }}
                />
              ))
            : displayedLegacyGoals.map((g) => (
                <GoalProgressCard
                  key={g.id}
                  goal={g}
                  activities={activitiesForGoals}
                />
              ))}
        </div>
      </div>
    </>
  );
}
