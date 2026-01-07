import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import type { Goal } from "../types";

const GOAL_RPC = "stats_goal_progress";
const HISTORY_DOTS_RPC = "get_goal_history_dots";

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

export function useGoalTrackingStats() {
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [starredGoalIds, setStarredGoalIds] = useState<string[]>([]);
  const [goalHistoryDots, setGoalHistoryDots] = useState<
    Record<string, Array<number | null>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }

    if (!user) {
      setError("You need to be signed in to view stats.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const [rpcRes, rawGoalsRes, prefsRes, dotsRes] = await Promise.all([
      supabase.rpc(GOAL_RPC, { user_id: user.id }),
      supabase
        .from("goals")
        .select("id, user_id, activity_type, metric, period, target, name, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase.from("goal_preferences").select("goal_id").eq("user_id", user.id),
      supabase.rpc(HISTORY_DOTS_RPC, { user_id: user.id, max_periods: 5 }),
    ]);

    if (rpcRes.error) {
      setError(`Could not load goal stats (${GOAL_RPC}): ${rpcRes.error.message}`);
      setLoading(false);
      return;
    }

    const statsData = (rpcRes.data as GoalStat[]) || [];
    setGoalStats(statsData);

    const rawGoals = (rawGoalsRes.data as Goal[]) || [];
    const fallbackGoals =
      statsData?.map((g) => ({
        id: g.goal_id,
        user_id: user.id,
        activity_type: g.activity_type as Goal["activity_type"],
        metric: g.metric as Goal["metric"],
        period: g.period,
        target: g.target,
        name: g.name,
        updated_at: undefined,
        created_at: undefined,
      })) || [];
    const combinedGoals = rawGoals.length > 0 ? rawGoals : fallbackGoals;

    if (rawGoalsRes.error) {
      console.error("Could not load goals", rawGoalsRes.error);
    }
    setGoals(combinedGoals);

    if (prefsRes.error) {
      console.error("Could not load goal preferences", prefsRes.error);
      setStarredGoalIds([]);
    } else {
      setStarredGoalIds((prefsRes.data || []).map((p) => p.goal_id));
    }

    if (dotsRes.error) {
      if (dotsRes.error.code === "42702") {
        console.warn(
          `History dots unavailable due to server ambiguity (${HISTORY_DOTS_RPC})`,
          dotsRes.error
        );
      } else {
        console.error(`Could not load goal history dots (${HISTORY_DOTS_RPC})`, dotsRes.error);
      }
      setGoalHistoryDots({});
    } else {
      const dotsData = (dotsRes.data as Array<{ goal_id: string; dot_state: number | null }>) || [];
      const map: Record<string, Array<number | null>> = {};
      dotsData.forEach((row) => {
        if (!row.goal_id) return;
        if (!map[row.goal_id]) map[row.goal_id] = [];
        map[row.goal_id].push(row.dot_state);
      });
      setGoalHistoryDots(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const toggleStar = useCallback(
    async (goalId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const isStarred = starredGoalIds.includes(goalId);

      if (isStarred) {
        await supabase
          .from("goal_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("goal_id", goalId);

        setStarredGoalIds((prev) => prev.filter((id) => id !== goalId));
      } else {
        if (starredGoalIds.length >= 2) {
          alert("You can select up to 2 goals to show on the home screen.");
          return;
        }

        await supabase.from("goal_preferences").insert({
          user_id: user.id,
          goal_id: goalId,
        });

        setStarredGoalIds((prev) => [...prev, goalId]);
      }
    },
    [starredGoalIds]
  );

  const buildGoalForEditing = useCallback(
    (goalStat: GoalStat): Goal => {
      const found = goals.find((g) => g.id === goalStat.goal_id);
      if (found) return found;
      return {
        id: goalStat.goal_id,
        user_id: userId || "",
        activity_type: goalStat.activity_type as Goal["activity_type"],
        metric: goalStat.metric as Goal["metric"],
        period: goalStat.period,
        target: goalStat.target,
        name: goalStat.name,
      };
    },
    [goals, userId]
  );

  const handleGoalDeleted = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setGoalStats((prev) => prev.filter((g) => g.goal_id !== id));
    setStarredGoalIds((prev) => prev.filter((gid) => gid !== id));
  }, []);

  return {
    userId,
    goalStats,
    goals,
    starredGoalIds,
    loading,
    error,
    refresh: fetchStats,
    toggleStar,
    buildGoalForEditing,
    handleGoalDeleted,
    setGoals,
    goalHistoryDots,
  };
}
