import { useMemo, useState } from "react";
import { ACTIVITY_TYPES } from "../../config/activityTypes";
import DirectionAddModal from "../DirectionAddModal";
import GoalDirectionCard from "../GoalDirectionCard";
import GoalDirectionSheet from "../GoalDirectionSheet";
import MicroAdjustmentCreateModal from "../MicroAdjustmentCreateModal";
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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMicroAdjustmentModal, setShowMicroAdjustmentModal] = useState(false);
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

      <DirectionAddModal
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSelectDirection={() => {
          setShowAddDialog(false);
          onAddGoal();
        }}
        onSelectMicroAdjustment={() => {
          setShowAddDialog(false);
          setShowMicroAdjustmentModal(true);
        }}
      />

      <MicroAdjustmentCreateModal
        open={showMicroAdjustmentModal}
        onClose={() => setShowMicroAdjustmentModal(false)}
      />

      <button
        type="button"
        aria-label="Add"
        onClick={() => setShowAddDialog(true)}
        className="fixed z-40 rounded-full bg-movenotes-primary text-primary-text shadow-lg shadow-movenotes-primary/30 active:scale-95 transition flex items-center justify-center gap-2 text-lg px-4 h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-movenotes-primary"
        style={{
          right: "calc(16px + env(safe-area-inset-right))",
          bottom: "calc(90px + env(safe-area-inset-bottom))",
        }}
      >
        <span className="text-2xl leading-none">+</span>
        <span className="text-sm font-semibold">Add</span>
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
