import { useEffect, useMemo, useState } from "react";
import type { Goal } from "../types";
import { fetchGoals, fetchGoalPreferences, fetchGoalStats } from "../services/goals.service";
import { useCallback } from "react";

export type GoalStat = {
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

const ACTIVITY_ORDER: Record<GoalStat["activity_type"], number> = {
  run: 0,
  ride: 1,
  walk: 2,
  strength: 3,
  yoga: 4,
  hike: 5,
  swim: 6,
  other: 7,
  any: 8,
};

export function useHomeGoals(userId: string | null, useRpcGoals: boolean) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);

  const refreshGoals = useCallback(async () => {
    if (!userId) return;

    const { data: g } = await fetchGoals(userId);
    setGoals((g as Goal[]) || []);

    const { data: prefs } = await fetchGoalPreferences(userId);
    setSelectedGoals(prefs?.map((p) => p.goal_id) || []);

    if (useRpcGoals) {
      const { data, error } = await fetchGoalStats(userId);
      if (!error) setGoalStats((data as GoalStat[]) || []);
    }
  }, [userId, useRpcGoals]);

  useEffect(() => {
    refreshGoals();
  }, [refreshGoals]);

  const sortedGoalStats = useMemo(
    () =>
      [...goalStats].sort((a, b) => {
        const aOrder = ACTIVITY_ORDER[a.activity_type] ?? 99;
        const bOrder = ACTIVITY_ORDER[b.activity_type] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.name || "").localeCompare(b.name || "");
      }),
    [goalStats]
  );

  const homeGoals = useMemo(
    () => goals.filter((g) => selectedGoals.includes(g.id)).slice(0, 3),
    [goals, selectedGoals]
  );

  const homeGoalStats = useMemo(
    () => sortedGoalStats.filter((g) => selectedGoals.includes(g.goal_id)).slice(0, 3),
    [sortedGoalStats, selectedGoals]
  );

  return {
    goals,
    selectedGoals,
    goalStats,
    setGoalStats,
    homeGoals,
    homeGoalStats,
    setGoals,
    setSelectedGoals,
    refreshGoals,
  };
}
