import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import HeaderLogo from "../components/HeaderLogo";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import TooltipBubble from "../components/TooltipBubble";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useNavigate } from "react-router-dom";
import { startOfWeek as dfStartOfWeek, format, subWeeks } from "date-fns";
import GoalProgressCard from "../components/GoalProgressCard";

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

type Activity = {
  type: keyof typeof ACTIVITY_TYPES;
  date: string;
  distance_km: number | null;
  duration_min: number | null;
};

const GOAL_RPC = "stats_goal_progress";

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function parseActivityDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
}

export default function StatsRpcPage() {
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PERIODS = ["all", "week", "month", "year"] as const;
  type Period = (typeof PERIODS)[number];
  const PERIOD_ORDER: Record<Exclude<Period, "all">, number> = {
    week: 1,
    month: 2,
    year: 3,
  };
  const [periodFilter, setPeriodFilter] = useState<Period>("all");
  const [activeTab, setActiveTab] = useState<"snapshot" | "trends">("snapshot");
  const { visible, showTooltip, hideTooltip, hasSeen } = useTooltipManager();
  const hasDoneOnboarding =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";
  const statsHeaderRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const fetchStats = async (_period: Period) => {
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

    const now = new Date();
    const earliest = startOfYear(now);
    earliest.setFullYear(earliest.getFullYear() - 1); // need previous year for comparisons
    const earliestStr = earliest.toISOString().split("T")[0];

    const [goalsRes, actsRes] = await Promise.all([
      supabase.rpc(GOAL_RPC, { user_id: user.id }),
      supabase
        .from("activities")
        .select("type, date, distance_km, duration_min")
        .eq("user_id", user.id)
        .gte("date", earliestStr),
    ]);

    if (goalsRes.error) {
      setError(
        `Could not load goal stats (${GOAL_RPC}): ${goalsRes.error.message}`
      );
      setLoading(false);
      return;
    }

    if (actsRes.error) {
      setError(
        `Could not load activity history: ${actsRes.error.message}`
      );
      setLoading(false);
      return;
    }

    setGoalStats((goalsRes.data as GoalStat[]) || []);

    const acts = (actsRes.data || []) as Activity[];
    setActivities(acts);

    setLoading(false);
  };

  useEffect(() => {
    fetchStats(periodFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchStats(periodFilter);
  }, [periodFilter]);

  useEffect(() => {
    if (!hasDoneOnboarding) return;
    if (!hasSeen("stats_trends_info")) {
      showTooltip("stats_trends_info");
    }
  }, [hasDoneOnboarding, hasSeen, showTooltip]);

  let filteredGoals = goalStats ?? [];
  if (periodFilter !== "all") {
    filteredGoals = filteredGoals.filter((g) => g.period === periodFilter);
  }
  filteredGoals = filteredGoals.sort((a, b) => {
    const aOrder = PERIOD_ORDER[a.period];
    const bOrder = PERIOD_ORDER[b.period];
    return aOrder - bOrder;
  });

  type TrendRow = {
    week: string; // ISO start-of-week (for uniqueness)
    weekLabel: string; // display end-of-week (Sunday)
    value: number | null;
    isFuture?: boolean;
  };
  type TrendInfo = {
    rows: TrendRow[];
    missingPrimary: boolean;
    primaryLabel: string;
  };

  const trends = useMemo(() => {
    if (!activities.length) return {} as Record<string, TrendInfo>;

    const now = new Date();
    const result: Record<string, TrendInfo> = {};

    Object.keys(ACTIVITY_TYPES).forEach((type) => {
      const cfg = ACTIVITY_TYPES[type as keyof typeof ACTIVITY_TYPES];
      if (!cfg) return;

      const primaryMetric = cfg.defaultFields.includes("distance_km")
        ? "distance_km"
        : cfg.defaultFields.includes("duration_min")
        ? "duration_min"
        : null;
      const primaryLabel =
        primaryMetric === "distance_km"
          ? "distance"
          : primaryMetric === "duration_min"
          ? "duration"
          : "activity";

      // Aggregate by week start
      const weekTotals = new Map<string, number>();
      let missingPrimary = false;

      activities.forEach((a) => {
        if (a.type !== type) return;

        const metric = cfg.defaultFields.includes("distance_km")
          ? Number(a.distance_km || 0)
          : Number(a.duration_min || 0);

        const wk = dfStartOfWeek(parseActivityDate(a.date), { weekStartsOn: 1 });
        const key = wk.toISOString().slice(0, 10);
        weekTotals.set(key, (weekTotals.get(key) || 0) + metric);

        const primaryMissing =
          primaryMetric === "distance_km"
            ? a.distance_km == null
            : primaryMetric === "duration_min"
            ? a.duration_min == null
            : false;
        if (primaryMissing) missingPrimary = true;
      });

      if (weekTotals.size === 0) {
        return;
      }

      // Determine window based only on recent weeks (max 9-week window)
      const sortedKeys = Array.from(weekTotals.keys()).sort();
      const lastWeek = dfStartOfWeek(
        parseActivityDate(sortedKeys[sortedKeys.length - 1]),
        { weekStartsOn: 1 }
      );

      // Drop any data older than 8 weeks before the last week (keeps at most 9 weeks span).
      const minAllowed = subWeeks(lastWeek, 8);
      const recentKeys = sortedKeys.filter((k) => {
        const wk = dfStartOfWeek(parseActivityDate(k), { weekStartsOn: 1 });
        return wk >= minAllowed;
      });
      if (recentKeys.length === 0) return;

      const firstWeek = dfStartOfWeek(parseActivityDate(recentKeys[0]), {
        weekStartsOn: 1,
      });

      const endWindow = subWeeks(lastWeek, -1); // one future week

      const windowWeeks: Date[] = [];

      let cursor = firstWeek;
      while (cursor <= endWindow) {
        windowWeeks.push(new Date(cursor));
        cursor = subWeeks(cursor, -1);
      }

      // cap to max 9 weeks by trimming oldest
      while (windowWeeks.length > 9) {
        windowWeeks.shift();
      }

      const rows: TrendRow[] = windowWeeks.map((w) => {
        const key = w.toISOString().slice(0, 10);
        const weekEnd = new Date(w);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekLabel = format(weekEnd, "dd MMM");
        const raw = weekTotals.get(key);
        // Show points only when data exists; otherwise leave a gap (null) so the line
        // doesn’t sit on zero for weeks with no activity.
        const value =
          w > lastWeek
            ? null
            : raw != null && raw > 0
            ? raw
            : null;

        return {
          week: key,
          weekLabel,
          value,
          isFuture: w > lastWeek,
        };
      });

      const hasCompletedWeek = rows.some((r, idx) => {
        const start = windowWeeks[idx];
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return end <= now && r.value != null && r.value > 0;
      });
      if (!hasCompletedWeek) return;

      result[type] = {
        rows,
        missingPrimary,
        primaryLabel,
      };
    });

    return result;
  }, [activities]);

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
            <div className="flex justify-center gap-2 mb-6">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={`px-4 py-2 rounded-full ${
                    periodFilter === p
                      ? "bg-movenotes-primary text-primary-text"
                      : "bg-movenotes-surface border border-movenotes-border text-movenotes-text"
                  }`}
                >
                  {p === "all"
                    ? "All"
                    : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {filteredGoals.map((goal) => (
              <GoalProgressCard
                key={goal.goal_id}
                goal={{ ...goal, progress_current: goal.current_value }}
              />
            ))}

            {filteredGoals.length === 0 && (
              <div className="text-center mt-10 text-movenotes-muted">
                <p className="mb-3">You haven't set any goals for this period.</p>
                <p className="text-sm mb-6">
                  Start with one small, achievable goal.
                  <br />
                  Simple goals help build consistency without pressure.
                </p>

                <button
                  onClick={() => navigate("/goals")}
                  className="px-4 py-2 rounded-full bg-movenotes-primary text-primary-text"
                >
                  Create a Goal
                </button>
              </div>
            )}

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
            {loading && (
              <p className="text-sm text-gray-500 text-center">Loading stats…</p>
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

            {!loading && !error && (
              <div className="space-y-10 mt-6">
                <h2 className="text-xl font-semibold text-movenotes-primary mb-2 text-center">
                  Your movement over time
                </h2>
                <p className="text-center text-movenotes-muted text-sm mb-6">
                  Weekly trends for each activity you've logged recently.
                </p>

                {Object.keys(trends).length === 0 && (
                  <p className="text-center text-movenotes-muted mt-8">
                    Not enough activity yet to show trends 🌱
                  </p>
                )}

                {Object.entries(trends).map(([type, trend]) => {
                  const rows = trend.rows;
                  const cfg = ACTIVITY_TYPES[type as keyof typeof ACTIVITY_TYPES];
                  const Icon = cfg.Icon;
                  return (
                    <div
                      key={type}
                      className="rounded-xl border border-movenotes-border p-6 bg-movenotes-surface shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-movenotes-primary">
                          <Icon size={20} />
                        </span>
                        <h3 className="text-lg font-semibold text-movenotes-text">
                          {cfg.label} —{" "}
                          {cfg.defaultFields.includes("distance_km")
                            ? "Distance (km)"
                            : "Duration (min)"}
                        </h3>
                      </div>

                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={rows}>
                          <XAxis dataKey="weekLabel" stroke="#888" fontSize={12} />
                          <YAxis stroke="#888" fontSize={12} />
                          <RechartsTooltip />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#5A7A69"
                            strokeWidth={3}
                            dot={true}
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      {trend.missingPrimary && (
                        <p className="text-xs text-movenotes-muted mt-3">
                          For {cfg.label}, Trends use {trend.primaryLabel} so the graph stays meaningful.
                          A few entries this period used only other details, so they aren’t shown here—your movement still counts.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <HeaderLogo withTagline delay={0.2} />
    </div>
  );
}
