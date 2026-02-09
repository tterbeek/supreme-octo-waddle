import { useEffect, useRef, useState } from "react";
import HeaderLogo from "../components/HeaderLogo";
import TooltipBubble from "../components/TooltipBubble";
import AddGoalModal from "../components/AddGoalModal";
import EditGoalModal from "../components/EditGoalModal";
import GoalTrackingTab from "../components/stats/GoalTrackingTab";
import TrendsTab from "../components/stats/TrendsTab";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useGoalTrackingStats, type GoalStat } from "../hooks/useGoalTrackingStats";
import { useActivityTrends } from "../hooks/useActivityTrends";
import type { Goal } from "../types";
import { useUnitSystem } from "../contexts/UnitContext";

const TAB_STORAGE_KEY = "stats_active_tab";

export default function StatsRpcPage() {
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [activeTab, setActiveTab] = useState<"goalTracking" | "trends">(() => {
    if (typeof window === "undefined") return "goalTracking";
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === "trends") return "trends";
    return "goalTracking";
  });

  const statsHeaderRef = useRef<HTMLDivElement | null>(null);
  const { unitSystem } = useUnitSystem();
  const { visible, showTooltip, hideTooltip, hasSeen } = useTooltipManager();
  const hasDoneOnboarding =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";

  const {
    userId,
    goalStats,
    goals,
    goalHistoryDots,
    loading: goalLoading,
    error: goalError,
    refresh: refreshGoals,
    buildGoalForEditing,
    handleGoalDeleted,
  } = useGoalTrackingStats();

  const {
    metasWithDefault,
    selectedMetric,
    trendData,
    trendsLoading,
    error: trendError,
    onToggleMetric,
    hasTrendRows,
    getDefaultMetric,
    canToggle,
  } = useActivityTrends(userId, activeTab === "trends");

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!hasDoneOnboarding) return;
    if (!hasSeen("stats_trends_info")) {
      showTooltip("stats_trends_info");
    }
  }, [hasDoneOnboarding, hasSeen, showTooltip]);

  const handleEditGoal = (goalStat: GoalStat) => {
    setEditingGoal(buildGoalForEditing(goalStat));
  };

  return (
    <div className="min-h-screen bg-movenotes-bg">
      <div className="relative h-0" ref={statsHeaderRef}>
        {visible === "stats_trends_info" && (
          <TooltipBubble position="bottom" onClose={hideTooltip}>
            Your stats update automatically as you log activities.
          </TooltipBubble>
        )}
      </div>

      <div className="sticky top-0 z-40 -mt-2 bg-movenotes-bg/95 backdrop-blur border-b border-movenotes-border/60 mb-6">
        <div className="flex items-center gap-2 px-0 py-2">
          {[
            { id: "goalTracking", label: "Direction" },
            { id: "trends", label: "Trends" },
          ].map(({ id, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as "goalTracking" | "trends")}
                className="relative flex-1 text-center text-sm font-medium pb-2"
              >
                <span
                  className={
                    active ? "text-movenotes-text" : "text-movenotes-muted"
                  }
                >
                  {label}
                </span>

                {active && (
                  <span className="absolute left-4 right-4 -bottom-0.5 h-0.5 rounded-full bg-movenotes-text/70" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "goalTracking" && (
          <GoalTrackingTab
            userId={userId}
            goalStats={goalStats}
            goalHistoryDots={goalHistoryDots}
            onEditGoal={handleEditGoal}
            onAddGoal={() => setShowAddGoal(true)}
            loading={goalLoading}
          />
      )}

      {activeTab === "trends" && (
        <TrendsTab
          metasWithDefault={metasWithDefault}
          selectedMetric={selectedMetric}
          trendData={trendData}
          getDefaultMetric={getDefaultMetric}
          onToggleMetric={onToggleMetric}
          canToggle={canToggle}
          hasTrendRows={hasTrendRows}
          trendsLoading={trendsLoading}
          error={trendError ?? goalError}
          unitSystem={unitSystem}
        />
      )}

      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onAdded={() => refreshGoals()}
          existingGoals={goals}
          onDuplicate={(goal) => setEditingGoal(goal)}
        />
      )}

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onUpdated={() => refreshGoals()}
          onDeleted={(id) => {
            setEditingGoal(null);
            handleGoalDeleted(id);
            refreshGoals();
          }}
        />
      )}

      <HeaderLogo withTagline />
    </div>
  );
}
