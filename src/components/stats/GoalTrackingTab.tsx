import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import { ACTIVITY_TYPES } from "../../config/activityTypes";
import GoalDirectionCard from "../GoalDirectionCard";
import GoalDirectionSheet from "../GoalDirectionSheet";
import type { GoalStat } from "../../hooks/useGoalTrackingStats";
import type { GoalDirectionGroup } from "../../lib/goalDirectionUtils";
import { pickPreferredMetricGoal } from "../../lib/goalDirectionUtils";

type GoalTrackingTabProps = {
  goalStats: GoalStat[];
  goalHistoryDots: Record<string, Array<number | null>>;
  onEditGoal: (goal: GoalStat) => void;
  onAddGoal: () => void;
  onSeeTrends: () => void;
  loading?: boolean;
};

export default function GoalTrackingTab({
  goalStats,
  goalHistoryDots,
  onEditGoal,
  onAddGoal,
  onSeeTrends,
  loading = false,
}: GoalTrackingTabProps) {
  const [activeGroup, setActiveGroup] = useState<GoalDirectionGroup | null>(null);
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

  const groupedGoals = useMemo(() => {
    const map = new Map<string, GoalDirectionGroup>();

    (goalStats ?? []).forEach((goal) => {
      const key = `${goal.activity_type}-${goal.period}`;
      if (!map.has(key)) {
        map.set(key, {
          activity_type: goal.activity_type,
          period: goal.period,
          goals: [goal],
        });
      } else {
        map.get(key)?.goals.push(goal);
      }
    });

    const groups = Array.from(map.values()).map((group) => ({
      ...group,
      dotGoal: pickPreferredMetricGoal(group),
    }));

    return groups.sort((a, b) => {
      const pDiff = PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period];
      if (pDiff !== 0) return pDiff;
      const tA = TYPE_ORDER[a.activity_type] ?? 999;
      const tB = TYPE_ORDER[b.activity_type] ?? 999;
      return tA - tB;
    });
  }, [goalStats]);

  return (
    <>
      {groupedGoals.map((group) => (
        <GoalDirectionCard
          key={`${group.activity_type}-${group.period}`}
          group={group}
          goalHistoryDots={goalHistoryDots}
          onClick={() => setActiveGroup(group)}
        />
      ))}

      {groupedGoals.length === 0 && !loading && (
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
        <span>Direction</span>
      </button>

      <div className="text-center mt-8">
        <button
          onClick={onSeeTrends}
          className="text-movenotes-accent underline text-sm"
        >
          See all activity stats →
        </button>
      </div>

      {activeGroup && (
        <GoalDirectionSheet
          group={activeGroup}
          onClose={() => setActiveGroup(null)}
          onEditGoal={(goal) => {
            setActiveGroup(null);
            onEditGoal(goal);
          }}
          onAddGoal={onAddGoal}
        />
      )}
    </>
  );
}
