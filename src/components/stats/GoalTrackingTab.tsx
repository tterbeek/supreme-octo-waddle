import { Target } from "lucide-react";
import { ACTIVITY_TYPES } from "../../config/activityTypes";
import GoalProgressCard from "../GoalProgressCard";
import type { GoalStat } from "../../hooks/useGoalTrackingStats";

type GoalTrackingTabProps = {
  goalStats: GoalStat[];
  starredGoalIds: string[];
  onEditGoal: (goal: GoalStat) => void;
  onToggleStar: (goalId: string) => void;
  onAddGoal: () => void;
  onSeeTrends: () => void;
  loading?: boolean;
};

export default function GoalTrackingTab({
  goalStats,
  starredGoalIds,
  onEditGoal,
  onToggleStar,
  onAddGoal,
  onSeeTrends,
  loading = false,
}: GoalTrackingTabProps) {
  const PERIOD_ORDER: Record<"week" | "month" | "year", number> = {
    week: 1,
    month: 2,
    year: 3,
  };
  const TYPE_ORDER: Record<string, number> = Object.keys(ACTIVITY_TYPES).reduce(
    (acc, id, idx) => {
      acc[id] = idx + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  TYPE_ORDER["any"] = Number.MAX_SAFE_INTEGER;

  const sortedGoals = (goalStats ?? []).slice().sort((a, b) => {
    const pDiff = PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period];
    if (pDiff !== 0) return pDiff;
    const tA = TYPE_ORDER[a.activity_type] ?? 999;
    const tB = TYPE_ORDER[b.activity_type] ?? 999;
    return tA - tB;
  });

  return (
    <>
      {sortedGoals.map((goal) => (
        <GoalProgressCard
          key={goal.goal_id}
          goal={{
            ...goal,
            id: goal.goal_id,
            progress_current: goal.current_value,
          }}
          onClick={() => onEditGoal(goal)}
          showStar
          starred={starredGoalIds.includes(goal.goal_id)}
          onToggleStar={() => onToggleStar(goal.goal_id)}
        />
      ))}

      {sortedGoals.length === 0 && !loading && (
        <div className="text-center mt-10 text-movenotes-muted">
          <p className="mb-3">You haven't set any goals yet.</p>
          <p className="text-sm mb-6">
            Start with one small, achievable goal.
            <br />
            Simple goals help build consistency without pressure.
          </p>
        </div>
      )}

      <button
        onClick={onAddGoal}
        className="w-full flex items-center justify-center gap-2 
             bg-amber-300 border border-amber-400 text-primary-text 
             py-3 rounded-full text-lg font-medium my-4"
      >
        <span className="text-xl">+</span>
        <Target className="w-5 h-5" />
        <span>Goal</span>
      </button>

      <div className="text-center mt-8">
        <button
          onClick={onSeeTrends}
          className="text-movenotes-accent underline text-sm"
        >
          See all activity stats →
        </button>
      </div>
    </>
  );
}
