import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { AlertCircle, Target } from "lucide-react";
import { supabase } from "../supabaseClient";
import HeaderLogo from "../components/HeaderLogo";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import TooltipBubble from "../components/TooltipBubble";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { format, startOfWeek } from "date-fns";
import GoalProgressCard from "../components/GoalProgressCard";
import AddGoalModal from "../components/AddGoalModal";
import EditGoalModal from "../components/EditGoalModal";
import type { Goal } from "../types";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles } from "../lib/units";

const TRENDS_META_RPC = "stats_activity_trend_meta";
const TRENDS_SERIES_RPC = "stats_activity_trend_series";

// Expected Supabase stored procedures:
// - stats_goal_progress(user_id uuid)
//     -> returns rows with goal_id, name, activity_type, metric, period, target,
//        current_value, unit, progress_ratio (0-1), comparison_pct (vs previous period)
// - stats_trends_90_days(user_id uuid)
//     -> returns rows with activity_type, total_distance, weekly_avg_distance,
//        trend_pct (vs previous 90 days), avg_feeling

type GoalStat = {
  goal_id: string;
  name: string | null;
  activity_type: keyof typeof ACTIVITY_TYPES | "any";
  metric: "distance" | "duration" | "count";
  period: "week" | "month" | "year";
  target: number;
  current_value: number;
  unit: "km" | "activities" | "min";
  progress_ratio: number;
  comparison_pct: number | null;
};

type TrendMeta = {
  activity_type: keyof typeof ACTIVITY_TYPES;
  has_distance: boolean;
  has_duration: boolean;
  default_metric: "distance" | "duration" | null;
};

type TrendPoint = {
  week_start: string;
  value: number;
};

const isSchemaCacheError = (err: any) =>
  typeof err?.message === "string" &&
  err.message.toLowerCase().includes("schema cache");

async function fetchTrendMeta(userId: string) {
  const { data, error } = await supabase.rpc(TRENDS_META_RPC, {
    target_user: userId,
    weeks_back: 9,
  });
  if (!error) return data as TrendMeta[];

  if (isSchemaCacheError(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase.rpc(
      TRENDS_META_RPC,
      {
        p_target_user: userId,
        p_weeks_back: 9,
      }
    );
    if (!fallbackError) return fallbackData as TrendMeta[];
  }

  throw error;
}

async function fetchTrendSeries(
  userId: string,
  activityType: string,
  metric: "distance" | "duration"
) {
  const { data, error } = await supabase.rpc(TRENDS_SERIES_RPC, {
    target_user: userId,
    activity_type: activityType,
    metric,
    weeks_back: 9,
  });
  if (!error) return data as TrendPoint[];

  if (isSchemaCacheError(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase.rpc(
      TRENDS_SERIES_RPC,
      {
        p_target_user: userId,
        p_activity_type: activityType,
        p_metric: metric,
        p_weeks_back: 9,
      }
    );
    if (!fallbackError) return fallbackData as TrendPoint[];
  }

  throw error;
}

const GOAL_RPC = "stats_goal_progress";

export default function StatsRpcPage() {
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [starredGoalIds, setStarredGoalIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [trendMeta, setTrendMeta] = useState<TrendMeta[]>([]);
  const [trendData, setTrendData] = useState<Record<string, TrendPoint[]>>({});
  const [selectedMetric, setSelectedMetric] = useState<
    Record<string, "distance" | "duration">
  >({});
  const [trendsLoading, setTrendsLoading] = useState(false);
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
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"snapshot" | "trends">(() => {
    if (typeof window === "undefined") return "snapshot";
    const saved = localStorage.getItem("stats_active_tab");
    return saved === "trends" ? "trends" : "snapshot";
  });
  const { visible, showTooltip, hideTooltip, hasSeen } = useTooltipManager();
  const hasDoneOnboarding =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";
  const statsHeaderRef = useRef<HTMLDivElement | null>(null);
  const { unitSystem } = useUnitSystem();

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("stats_active_tab", activeTab);
  }, [activeTab]);

  const fetchStats = async () => {
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

  const [rpcRes, rawGoalsRes, prefsRes] = await Promise.all([
    supabase.rpc(GOAL_RPC, { user_id: user.id }),
    supabase
      .from("goals")
      .select("id, user_id, activity_type, metric, period, target, name, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
      supabase
        .from("goal_preferences")
        .select("goal_id")
        .eq("user_id", user.id),
    ]);

    if (rpcRes.error) {
      setError(
        `Could not load goal stats (${GOAL_RPC}): ${rpcRes.error.message}`
      );
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
    const combinedGoals =
      rawGoals.length > 0 ? rawGoals : fallbackGoals;

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

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasDoneOnboarding) return;
    if (!hasSeen("stats_trends_info")) {
      showTooltip("stats_trends_info");
    }
  }, [hasDoneOnboarding, hasSeen, showTooltip]);

  const sortedGoals = (goalStats ?? []).slice().sort((a, b) => {
    const pDiff = PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period];
    if (pDiff !== 0) return pDiff;
    const tA = TYPE_ORDER[a.activity_type] ?? 999;
    const tB = TYPE_ORDER[b.activity_type] ?? 999;
    return tA - tB;
  });

  const buildGoalForEditing = (goalStat: GoalStat): Goal => {
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
  };

  const toggleStar = async (goalId: string) => {
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
  };

  const canToggle = (meta: TrendMeta) => meta.has_distance && meta.has_duration;

  useEffect(() => {
    if (activeTab !== "trends" || !userId) return;

    setTrendsLoading(true);
    fetchTrendMeta(userId)
      .then((data) => {
        setTrendMeta(data || []);
        setError(null);
      })
      .catch((err: any) => {
        console.error("[Trends] Meta fetch error:", err?.message || err);
        setError(err?.message || "Could not load trends.");
      })
      .finally(() => setTrendsLoading(false));
  }, [activeTab, userId]);

  useEffect(() => {
    if (!trendMeta.length || !userId) return;

    trendMeta.forEach((meta) => {
      if (!meta.default_metric) return;
      setSelectedMetric((prev) =>
        prev[meta.activity_type]
          ? prev
          : { ...prev, [meta.activity_type]: meta.default_metric as "distance" | "duration" }
      );
    });

    const missing = trendMeta.filter(
      (meta) =>
        meta.default_metric &&
        !trendData[`${meta.activity_type}:${meta.default_metric}`]
    );

    if (!missing.length) return;

    let cancelled = false;
    setTrendsLoading(true);

    const loadSeries = async () => {
      try {
        await Promise.all(
          missing.map(async (meta) => {
            if (!meta.default_metric) return;
            const series = await fetchTrendSeries(
              userId,
              meta.activity_type,
              meta.default_metric
            );
            if (cancelled) return;
            setTrendData((prev) => ({
              ...prev,
              [`${meta.activity_type}:${meta.default_metric}`]: series,
            }));
          })
        );
      } catch (err: any) {
        if (!cancelled) {
          console.error("[Trends] Series fetch error:", err?.message || err);
          setError(err?.message || "Could not load trend data.");
        }
      } finally {
        if (!cancelled) {
          setTrendsLoading(false);
        }
      }
    };

    loadSeries();

    return () => {
      cancelled = true;
    };
    // trendData is intentionally included to avoid refetching loaded series
  }, [trendMeta, trendData, userId]);

  const onToggleMetric = async (
    activityType: string,
    metric: "distance" | "duration"
  ) => {
    if (!userId) return;

    setSelectedMetric((prev) => ({ ...prev, [activityType]: metric }));

    const key = `${activityType}:${metric}`;
    if (trendData[key]) return;

    try {
      setTrendsLoading(true);
      const series = await fetchTrendSeries(userId, activityType, metric);
      setTrendData((prev) => ({ ...prev, [key]: series }));
    } catch (err: any) {
      console.error("[Trends] Series fetch error:", err?.message || err);
      setError(err?.message || "Could not load trend data.");
    } finally {
      setTrendsLoading(false);
    }
  };

  const metasWithDefault = trendMeta.filter((meta) => meta.default_metric);

  const hasTrendRows = metasWithDefault.some((meta) => {
    const activeMetric =
      selectedMetric[meta.activity_type] ?? (meta.default_metric as "distance" | "duration");
    const key = `${meta.activity_type}:${activeMetric}`;
    return (trendData[key]?.length || 0) > 0;
  });

  return (
    <div className="min-h-screen bg-movenotes-bg p-2">
      <div className="p-2 max-w-md mx-auto">
        <div
          className="mb-4 relative flex items-center justify-center"
          ref={statsHeaderRef}
        >
          {visible === "stats_trends_info" && (
            <TooltipBubble position="bottom" onClose={hideTooltip}>
              Your stats update automatically as you log activities.
            </TooltipBubble>
          )}
        </div>

        {/* Top-level tabs */}
        <div className="flex justify-center gap-10 mb-6 mt-2">
          {["snapshot", "trends"].map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as "snapshot" | "trends")}
                className="relative pb-1 text-base"
              >
                <span
                  className={
                    active
                      ? "text-movenotes-primary font-semibold"
                      : "text-movenotes-muted"
                  }
                >
                  {tab === "snapshot" ? "Goal Tracking" : "Trends"}
                </span>

                {active && (
                  <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-movenotes-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "snapshot" && (
          <>
            {sortedGoals.map((goal) => (
              <GoalProgressCard
                key={goal.goal_id}
                goal={{
                  ...goal,
                  id: goal.goal_id,
                  progress_current: goal.current_value,
                }}
                onClick={() => setEditingGoal(buildGoalForEditing(goal))}
                showStar
                starred={starredGoalIds.includes(goal.goal_id)}
                onToggleStar={() => toggleStar(goal.goal_id)}
              />
            ))}

            {sortedGoals.length === 0 && (
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
              onClick={() => setShowAddGoal(true)}
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
                onClick={() => setActiveTab("trends")}
                className="text-movenotes-accent underline text-sm"
              >
                See all activity stats →
              </button>
            </div>
          </>
        )}

        {activeTab === "trends" && (
          <>
            {(loading || trendsLoading) && (
              <p className="text-sm text-gray-500 text-center">Loading trends…</p>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Unable to load stats</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            {!error && (
              <div className="space-y-10 mt-6">
                <h2 className="text-xl font-semibold text-movenotes-primary mb-2 text-center">
                  Your movement over time
                </h2>
                <p className="text-center text-movenotes-muted text-sm mb-6">
                  Weekly trends for each activity you've logged recently.
                </p>

                {!hasTrendRows && !trendsLoading && (
                  <p className="text-center text-movenotes-muted mt-8">
                    Not enough activity yet to show trends 🌱
                  </p>
                )}

                {metasWithDefault.map((meta) => {
                  if (!meta.default_metric) return null;
                  const cfg = ACTIVITY_TYPES[meta.activity_type];
                  const Icon = cfg.Icon;
                  const activeMetric =
                    selectedMetric[meta.activity_type] ?? meta.default_metric;
                  const key = `${meta.activity_type}:${activeMetric}`;
                  const series = trendData[key] || [];
                  if (!series.length) return null;
                  const unitLabel =
                    activeMetric === "distance"
                      ? unitSystem === "imperial"
                        ? "mi"
                        : "km"
                      : "min";

                  const currentWeekStr = format(
                    startOfWeek(new Date(), { weekStartsOn: 1 }),
                    "yyyy-MM-dd"
                  );

                  const rows = series.map((point) => {
                    const start = new Date(point.week_start + "T00:00:00");
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    const isCurrent = point.week_start === currentWeekStr;
                    const value =
                      activeMetric === "distance" && unitSystem === "imperial"
                        ? kmToMiles(point.value)
                        : point.value;
                    return {
                      week: point.week_start,
                      weekLabel: format(end, "dd MMM"),
                      value,
                      isCurrent,
                    };
                  });

                  const currentIdx = rows.findIndex((r) => r.isCurrent);
                  const lastCompletedIdx = rows
                    .map((r, idx) => ({ idx, isCurrent: r.isCurrent }))
                    .filter((r) => !r.isCurrent)
                    .map((r) => r.idx)
                    .pop();

                  const rowsWithLines = rows.map((row, idx) => {
                    const isCurrent = row.isCurrent;
                    const isLastCompleted = idx === lastCompletedIdx;
                    const valueSolid = isCurrent ? null : row.value;
                    const valueCurrent =
                      isCurrent || (isLastCompleted && currentIdx !== -1)
                        ? row.value
                        : null;

                    return {
                      ...row,
                      valueSolid,
                      valueCurrent,
                    };
                  });

                  const showToggle = canToggle(meta);

                  return (
                    <div
                      key={meta.activity_type}
                      className="rounded-xl border border-movenotes-border p-6 bg-movenotes-surface shadow-sm"
                    >
                      <div className="flex flex-col items-center gap-3 mb-3 text-center">
                        <div className="flex items-center gap-2">
                          <span className="text-movenotes-primary">
                            <Icon size={20} />
                          </span>
                          <h3 className="text-lg font-semibold text-movenotes-text">
                            {cfg.label} —{" "}
                            {activeMetric === "distance"
                              ? `Distance (${unitLabel})`
                              : "Duration (min)"}
                          </h3>
                        </div>

                        {showToggle && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onToggleMetric(meta.activity_type, "distance")}
                              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                                activeMetric === "distance"
                                  ? "bg-movenotes-primary text-primary-text border-movenotes-primary"
                                  : "border-warm-200 text-gray-700"
                              }`}
                            >
                              Distance
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleMetric(meta.activity_type, "duration")}
                              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                                activeMetric === "duration"
                                  ? "bg-movenotes-primary text-primary-text border-movenotes-primary"
                                  : "border-warm-200 text-gray-700"
                              }`}
                            >
                              Duration
                            </button>
                          </div>
                        )}
                      </div>

                      {showToggle && (
                        <p className="text-xs text-movenotes-muted mb-3 text-center">
                          This graph shows only the entries where this metric was logged.
                        </p>
                      )}

                      {!showToggle && (
                        <div className="mb-3" />
                      )}

                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={rowsWithLines}>
                          <XAxis dataKey="weekLabel" stroke="#888" fontSize={12} />
                          <YAxis
                            stroke="#888"
                            fontSize={12}
                            label={{ value: unitLabel, angle: -90, position: "insideLeft" }}
                            tickFormatter={(v: number | string) =>
                              activeMetric === "distance"
                                ? Number(v).toFixed(0)
                                : Number(v).toFixed(0)
                            }
                          />
                          <RechartsTooltip
                            formatter={(value: number | string) =>
                              activeMetric === "distance"
                                ? `${Number(value).toFixed(0)} ${unitLabel}`
                                : `${Number(value).toFixed(0)} ${unitLabel}`
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="valueSolid"
                            stroke="#5A7A69"
                            strokeWidth={3}
                            dot={true}
                          />
                          <Line
                            type="monotone"
                            dataKey="valueCurrent"
                            stroke="#5A7A69"
                            strokeWidth={3}
                            strokeDasharray="4 4"
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onAdded={() => fetchStats()}
          existingGoals={goals}
          onDuplicate={(goal) => setEditingGoal(goal)}
        />
      )}

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onUpdated={() => fetchStats()}
          onDeleted={(id) => {
            setEditingGoal(null);
            setGoals((prev) => prev.filter((g) => g.id !== id));
            setGoalStats((prev) => prev.filter((g) => g.goal_id !== id));
            setStarredGoalIds((prev) => prev.filter((gid) => gid !== id));
            fetchStats();
          }}
        />
      )}

      <HeaderLogo withTagline delay={0.2} />
    </div>
  );
}
