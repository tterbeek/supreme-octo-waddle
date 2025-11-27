import { useEffect, useState } from "react";
import {
  Bike,
  Footprints,
  Frown,
  Meh,
  Laugh,
  Smile,
  Target,
  Hash,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import HeaderLogo from "../components/HeaderLogo";

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
  activity_type: "run" | "ride" | "any";
  metric: "distance" | "count";
  period: "week" | "month" | "year";
  target: number;
  current_value: number;
  unit: "km" | "activities";
  progress_ratio: number;
  comparison_pct: number | null;
};

type TrendStat = {
  activity_type: "run" | "ride";
  total_distance: number;
  weekly_avg_distance: number;
  trend_pct: number | null;
  avg_feeling: number | null;
};

type FallbackSummary = {
  period: "week" | "month" | "year";
  activity_type: "run" | "ride";
  total_distance: number;
  change_pct: number | null;
};

const GOAL_RPC = "stats_goal_progress";
const TREND_RPC = "stats_trends_90_days";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function periodBounds(
  period: "week" | "month" | "year",
  now = new Date()
) {
  const startCurrent =
    period === "week"
      ? startOfWeek(now)
      : period === "month"
      ? startOfMonth(now)
      : startOfYear(now);

  const endCurrent = new Date(startCurrent);
  if (period === "week") endCurrent.setDate(startCurrent.getDate() + 7);
  else if (period === "month") endCurrent.setMonth(startCurrent.getMonth() + 1);
  else endCurrent.setFullYear(startCurrent.getFullYear() + 1);

  const startPrev = new Date(startCurrent);
  if (period === "week") startPrev.setDate(startPrev.getDate() - 7);
  else if (period === "month") startPrev.setMonth(startPrev.getMonth() - 1);
  else startPrev.setFullYear(startPrev.getFullYear() - 1);

  const endPrev = new Date(startCurrent);

  return { startCurrent, endCurrent, startPrev, endPrev };
}

function parseActivityDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
}

function GoalStatCard({ stat }: { stat: GoalStat }) {
  const ActivityIcon =
    stat.activity_type === "run"
      ? Footprints
      : stat.activity_type === "ride"
      ? Bike
      : Target;

  const MetricIcon = stat.metric === "distance" ? Target : Hash;

  const ratio = Math.max(0, Math.min(1, Number(stat.progress_ratio) || 0));
  const comparison = stat.comparison_pct === null ? null : Math.round(stat.comparison_pct);

  const comparisonClass =
    comparison === null
      ? ""
      : comparison === 0
      ? "text-gray-500"
      : comparison >= 0
      ? "text-green-600"
      : comparison >= -5
      ? "text-gray-500"
      : comparison >= -15
      ? "text-yellow-500"
      : "text-red-600";

  return (
    <div className="rounded-xl bg-warm-100 border border-warm-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <ActivityIcon className="w-5 h-5 text-gray-900" />
        <MetricIcon className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
          {stat.name || `${stat.activity_type} ${stat.metric}`}
        </h3>
      </div>

      <div className="text-base text-gray-900 font-medium">
        {Math.round(stat.current_value)} / {Math.round(stat.target)}{" "}
        {stat.unit}
      </div>

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

      {comparison !== null && (
        <p
          className={`text-sm mt-2 ${comparisonClass}`}
        >
          {comparison === 0
            ? "no change from previous period"
            : `${comparison >= 0 ? "↑" : "↓"} ${comparison}% vs previous period`}
        </p>
      )}
    </div>
  );
}

function FallbackCard({ summary }: { summary: FallbackSummary }) {
  const ActivityIcon = summary.activity_type === "run" ? Footprints : Bike;
  const comparison =
    summary.change_pct === null ? null : Math.round(summary.change_pct);

  const comparisonClass =
    comparison === null
      ? ""
      : comparison === 0
      ? "text-gray-500"
      : comparison >= 0
      ? "text-green-600"
      : comparison >= -5
      ? "text-gray-500"
      : comparison >= -15
      ? "text-yellow-500"
      : "text-red-600";

  return (
    <div className="rounded-xl bg-warm-50 border border-warm-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <ActivityIcon className="w-5 h-5 text-gray-900" />
        <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
          {summary.activity_type.toUpperCase()} — no goal set
        </h3>
      </div>

      <p className="text-base text-gray-900 font-medium">
        {Math.round(summary.total_distance)} km this period
      </p>

      {comparison !== null && (
        <p className={`text-sm mt-2 ${comparisonClass}`}>
          {comparison === 0
            ? "no change from previous period"
            : `${comparison >= 0 ? "↑" : "↓"} ${comparison}% vs previous period`}
        </p>
      )}

      {comparison === null && (
        <p className="text-sm mt-2 text-gray-500">
          No previous period data for comparison
        </p>
      )}
    </div>
  );
}

function TrendCard({ trend }: { trend: TrendStat }) {
  const hasData = (trend.total_distance || 0) > 0;
  const comparison =
    trend.trend_pct === null ? null : Math.round(trend.trend_pct);

  const comparisonClass =
    comparison === null
      ? ""
      : comparison === 0
      ? "text-gray-500"
      : comparison >= 0
      ? "text-green-600"
      : comparison >= -5
      ? "text-gray-500"
      : comparison >= -15
      ? "text-yellow-500"
      : "text-red-600";

  const FeelingIcon =
    trend.avg_feeling === null
      ? Meh
      : trend.avg_feeling <= 1.5
      ? Frown
      : trend.avg_feeling <= 2.5
      ? Meh
      : trend.avg_feeling <= 3.5
      ? Smile
      : Laugh;

  return (
    <div className="bg-warm-100 border border-warm-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {trend.activity_type === "run" ? (
          <Footprints className="w-5 h-5 text-gray-900" />
        ) : (
          <Bike className="w-5 h-5 text-gray-900" />
        )}
        <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
          {trend.activity_type.toUpperCase()}
        </h3>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-500 italic">Not enough data yet</p>
      ) : (
        <>
          <p className="text-base text-gray-900 font-medium">
            {Math.round(trend.total_distance)} km total
            <span className="text-sm text-gray-600 ml-1">
              · {Math.round(trend.weekly_avg_distance)} km / week avg
            </span>
          </p>

          <div className="flex justify-center mt-2">
            <FeelingIcon className="w-6 h-6 text-movenotes-accent" />
          </div>

          {comparison !== null && (
            <p className={`text-sm mt-2 text-center ${comparisonClass}`}>
              {comparison === 0
                ? "no change from previous period"
                : `${comparison >= 0 ? "↑" : "↓"} ${comparison}% vs previous 90 days`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function StatsRpcPage() {
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [trendStats, setTrendStats] = useState<TrendStat[]>([]);
  const [fallbackSummaries, setFallbackSummaries] = useState<FallbackSummary[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activityOrder: Record<GoalStat["activity_type"], number> = {
    run: 0,
    ride: 1,
    any: 2,
  };

  useEffect(() => {
    const load = async () => {
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

      const [goalsRes, trendsRes, actsRes] = await Promise.all([
        supabase.rpc(GOAL_RPC, { user_id: user.id }),
        supabase.rpc(TREND_RPC, { user_id: user.id }),
        supabase
          .from("activities")
          .select("type, date, distance_km")
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

      if (trendsRes.error) {
        setError(
          `Could not load trend stats (${TREND_RPC}): ${trendsRes.error.message}`
        );
        setLoading(false);
        return;
      }

      if (actsRes.error) {
        setError(
          `Could not load activity history for fallbacks: ${actsRes.error.message}`
        );
        setLoading(false);
        return;
      }

      setGoalStats((goalsRes.data as GoalStat[]) || []);
      setTrendStats((trendsRes.data as TrendStat[]) || []);

      const acts = (actsRes.data || []) as {
        type: "run" | "ride";
        date: string;
        distance_km: number;
      }[];

      const computeFallback = (
        period: "week" | "month" | "year",
        activity_type: "run" | "ride"
      ): FallbackSummary | null => {
        const { startCurrent, endCurrent, startPrev, endPrev } = periodBounds(
          period,
          now
        );

        const inRange = (d: Date, s: Date, e: Date) => d >= s && d < e;

        const ofType = acts.filter((a) => a.type === activity_type);
        const currentTotal = ofType
          .filter((a) =>
            inRange(parseActivityDate(a.date), startCurrent, endCurrent)
          )
          .reduce((sum, a) => sum + Number(a.distance_km || 0), 0);
        if (currentTotal <= 0) return null; // no activity, no fallback needed

        const prevTotal = ofType
          .filter((a) =>
            inRange(parseActivityDate(a.date), startPrev, endPrev)
          )
          .reduce((sum, a) => sum + Number(a.distance_km || 0), 0);

        const change_pct =
          prevTotal > 0 ? (currentTotal / prevTotal - 1) * 100 : null;

        return {
          period,
          activity_type,
          total_distance: currentTotal,
          change_pct,
        };
      };

      const fallback: FallbackSummary[] = [];
      (["week", "month", "year"] as const).forEach((period) => {
        (["run", "ride"] as const).forEach((activity_type) => {
          const hasGoal = goalsRes.data?.some(
            (g: GoalStat) =>
              g.period === period && g.activity_type === activity_type
          );
          if (hasGoal) return;
          const summary = computeFallback(period, activity_type);
          if (summary) fallback.push(summary);
        });
      });

      setFallbackSummaries(fallback);
      setLoading(false);
    };

    load();
  }, []);

  const sortGoals = (items: GoalStat[]) =>
    [...items].sort((a, b) => {
      const aOrder = activityOrder[a.activity_type] ?? 99;
      const bOrder = activityOrder[b.activity_type] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || "").localeCompare(b.name || "");
    });

  const weeklyGoals = sortGoals(goalStats.filter((g) => g.period === "week"));
  const monthlyGoals = sortGoals(goalStats.filter((g) => g.period === "month"));
  const yearlyGoals = sortGoals(goalStats.filter((g) => g.period === "year"));

  const sortSummaries = (items: FallbackSummary[]) =>
    [...items].sort((a, b) => {
      const aOrder = activityOrder[a.activity_type] ?? 99;
      const bOrder = activityOrder[b.activity_type] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return 0;
    });

  const weeklyFallbacks = sortSummaries(
    fallbackSummaries.filter((f) => f.period === "week")
  );
  const monthlyFallbacks = sortSummaries(
    fallbackSummaries.filter((f) => f.period === "month")
  );
  const yearlyFallbacks = sortSummaries(
    fallbackSummaries.filter((f) => f.period === "year")
  );

  return (
    <div className="min-h-screen bg-movenotes-bg p-2">
      <div className="p-2 max-w-md mx-auto">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-gray-600 text-center">
            Stats (Supabase)
          </h1>
          <p className="text-xs text-gray-500 text-center mt-1">
            All metrics are precomputed via Supabase stored procedures.
          </p>
        </div>

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
          <>
            {goalStats.length === 0 && (
              <p className="text-sm text-gray-500">No goals found.</p>
            )}

            {(weeklyGoals.length > 0 || weeklyFallbacks.length > 0) && (
              <>
                <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-6 mb-3 border-b border-amber-300/50 pb-1">
                  WEEK
                </h2>
                <div className="flex flex-col gap-4">
                  {weeklyGoals.map((g) => (
                    <GoalStatCard key={g.goal_id} stat={g} />
                  ))}
                  {weeklyFallbacks.map((f, idx) => (
                    <FallbackCard key={`fallback-week-${f.activity_type}-${idx}`} summary={f} />
                  ))}
                </div>
              </>
            )}

            {(monthlyGoals.length > 0 || monthlyFallbacks.length > 0) && (
              <>
                <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-6 mb-3 border-b border-amber-300/50 pb-1">
                  MONTH
                </h2>
                <div className="flex flex-col gap-4">
                  {monthlyGoals.map((g) => (
                    <GoalStatCard key={g.goal_id} stat={g} />
                  ))}
                  {monthlyFallbacks.map((f, idx) => (
                    <FallbackCard key={`fallback-month-${f.activity_type}-${idx}`} summary={f} />
                  ))}
                </div>
              </>
            )}

            {(yearlyGoals.length > 0 || yearlyFallbacks.length > 0) && (
              <>
                <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-6 mb-3 border-b border-amber-300/50 pb-1">
                  YEAR
                </h2>
                <div className="flex flex-col gap-4">
                  {yearlyGoals.map((g) => (
                    <GoalStatCard key={g.goal_id} stat={g} />
                  ))}
                  {yearlyFallbacks.map((f, idx) => (
                    <FallbackCard key={`fallback-year-${f.activity_type}-${idx}`} summary={f} />
                  ))}
                </div>
              </>
            )}

            <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
              LAST 90 DAYS TREND (DB)
            </h2>
            <div className="flex flex-col gap-4">
              {(["run", "ride"] as const).map((type) => {
                const stat = trendStats.find(
                  (t) => t.activity_type === type
                ) || {
                  activity_type: type,
                  total_distance: 0,
                  weekly_avg_distance: 0,
                  trend_pct: null,
                  avg_feeling: null,
                };

                return <TrendCard key={type} trend={stat} />;
              })}
            </div>
          </>
        )}
      </div>

      <HeaderLogo withTagline delay={0.2} />
    </div>
  );
}
