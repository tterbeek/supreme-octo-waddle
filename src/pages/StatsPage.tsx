import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function StatsPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const parseDate = (value: string | Date) => {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value + "T00:00:00Z") : new Date(value);
  return isNaN(d.getTime()) ? null : d;
  };



  useEffect(() => {
    const load = async () => {
      const { data: acts } = await supabase
        .from("activities")
        .select("*")
        .order("date", { ascending: false });
      setActivities(acts || []);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: g } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id);
      setGoals(g || []);
    };
    load();
  }, []);

  // Helpers
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);

  const group = (filterFn: (a: any) => boolean) => {
    const filtered = activities.filter(filterFn);
    return {
      run: filtered.filter((a) => a.type === "run"),
      ride: filtered.filter((a) => a.type === "ride"),
    };
  };

  const now = new Date();

  // --- PERIOD HELPERS ---
  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const startOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1);

  // --- WEEKS ---
  const currentWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const weekBeforeStart = new Date(currentWeekStart);
  weekBeforeStart.setDate(weekBeforeStart.getDate() - 14);

  const currentWeek = group((a) => new Date(a.date) >= currentWeekStart);
  const lastWeek = group(
    (a) =>
      new Date(a.date) >= lastWeekStart &&
      new Date(a.date) < currentWeekStart
  );
  const weekBefore = group(
    (a) =>
      new Date(a.date) >= weekBeforeStart &&
      new Date(a.date) < lastWeekStart
  );

  // --- MONTHS ---
  const currentMonthStart = startOfMonth(now);
  const lastMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );
  const monthBeforeStart = new Date(
    now.getFullYear(),
    now.getMonth() - 2,
    1
  );

  const currentMonth = group((a) => new Date(a.date) >= currentMonthStart);
  const lastMonth = group(
    (a) =>
      new Date(a.date) >= lastMonthStart &&
      new Date(a.date) < currentMonthStart
  );
  const monthBefore = group(
    (a) =>
      new Date(a.date) >= monthBeforeStart &&
      new Date(a.date) < lastMonthStart
  );

  // --- YEAR ---
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const currentYear = group((a) => new Date(a.date) >= yearStart);

  const getGoal = (type: "run" | "ride", period: string) =>
    goals.find((g) => g.type === type && g.period === period);

  // --- UI COMPONENTS ---
  const ProgressRow = ({
    label,
    current,
    goal,
  }: {
    label: string;
    current: number;
    goal?: any;
  }) => {
    const target = goal?.distance_km || 0;
    const progress = target > 0 ? Math.min(1, current / target) : 0;

    return (
      <div className="mb-3">
        <div className="text-sm text-gray-700 font-medium">{label}</div>
        {goal ? (
          <>
            <div className="text-sm text-gray-800">
              {current.toFixed(0)} / {target} km
            </div>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < Math.floor(progress * 5)
                      ? "bg-movenotes-accent"
                      : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400">No goal set</div>
        )}
      </div>
    );
  };

  const CompareRow = ({
    label,
    currentArr,
    prevArr,
    periodLabel,
  }: {
    label: string;
    currentArr: any[];
    prevArr: any[];
    periodLabel: string;
  }) => {
    const currDist = sum(currentArr.map((a) => a.distance_km));
    const prevDist = sum(prevArr.map((a) => a.distance_km));

    if (currDist === 0 && prevDist === 0)
      return (
        <div className="text-xs text-gray-400 mt-1">Not enough data</div>
      );

    const change =
      prevDist > 0 ? ((currDist / prevDist - 1) * 100).toFixed(0) : null;

    return (
      <div className="text-xs text-gray-600">
        {label}: {currDist.toFixed(0)} km{" "}
        {change && (
          <>
            {currDist > prevDist ? (
              <span className="text-green-600">↑ {change}%</span>
            ) : currDist < prevDist ? (
              <span className="text-red-600">↓ {change}%</span>
            ) : (
              "(same)"
            )}
          </>
        )}{" "}
        vs previous {periodLabel}
      </div>
    );
  };

  // --- RENDER ---
  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate("/")} className="text-sm underline">
          ← Back
        </button>
        <h1 className="text-lg font-bold">Stats</h1>
        <div className="w-10" />
      </div>

      {/* WEEK */}
      <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
        WEEK
      </h2>
      {(["run", "ride"] as const).map((type) => {
        const goal = getGoal(type, "week");
        return (
          <div key={type} className="mb-4">
            <ProgressRow
              label={`${type.toUpperCase()} — This week`}
              current={sum(currentWeek[type].map((a) => a.distance_km))}
              goal={goal}
            />
            <CompareRow
              label={`${type.toUpperCase()} — Last week`}
              currentArr={lastWeek[type]}
              prevArr={weekBefore[type]}
              periodLabel="week"
            />
          </div>
        );
      })}

      {/* MONTH */}
      <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
        MONTH
      </h2>
      {(["run", "ride"] as const).map((type) => {
        const goal = getGoal(type, "month");
        return (
          <div key={type} className="mb-4">
            <ProgressRow
              label={`${type.toUpperCase()} — This month`}
              current={sum(currentMonth[type].map((a) => a.distance_km))}
              goal={goal}
            />
            <CompareRow
              label={`${type.toUpperCase()} — Last month`}
              currentArr={lastMonth[type]}
              prevArr={monthBefore[type]}
              periodLabel="month"
            />
          </div>
        );
      })}

      {/* YEAR */}
      <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
        YEAR
      </h2>
      {(["run", "ride"] as const).map((type) => (
        <div key={type} className="mb-4">
          <div className="text-sm text-gray-800">
            {type.toUpperCase()}:{" "}
            {sum(currentYear[type].map((a) => a.distance_km)).toFixed(0)} km ·{" "}
            {currentYear[type].length} activities
          </div>
        </div>
      ))}

{/* ROLLING 90 DAYS */}
<h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
  LAST 90 DAYS TREND
</h2>

<div className="flex flex-col gap-4">
  {(["run", "ride"] as const).map((type) => {
    const days90Ago = new Date();
    days90Ago.setDate(days90Ago.getDate() - 90);

    const days180Ago = new Date(days90Ago);
    days180Ago.setDate(days180Ago.getDate() - 90);

    const current90 = activities.filter(
      (a) => a.type === type && parseDate(a.date)! >= days90Ago
    );
    const previous90 = activities.filter(
      (a) =>
        a.type === type &&
        parseDate(a.date)! >= days180Ago &&
        parseDate(a.date)! < days90Ago
    );

    const currDist = sum(current90.map((a) => a.distance_km));
    const prevDist = sum(previous90.map((a) => a.distance_km));
    const trend =
      prevDist > 0 ? ((currDist / prevDist - 1) * 100).toFixed(0) : null;
    const avgFeeling = avg(current90.map((a) => a.feeling));

    const labelIcon = type === "run" ? "🏃‍♂️" : "🚴‍♀️";
    const hasData = current90.length > 0;

    return (
      <div
        key={type}
        className="bg-warm-100 border border-warm-200 rounded-xl p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{labelIcon}</span>
          <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
            {type.toUpperCase()}
          </h3>
        </div>

        {!hasData ? (
          <p className="text-sm text-gray-500 italic">Not enough data yet</p>
        ) : (
          <>
            <p className="text-base text-gray-900 font-medium">
              {currDist.toFixed(0)} km total
              <span className="text-sm text-gray-600 ml-1">
                · {(currDist / 12.9).toFixed(1)} km / week avg
              </span>
            </p>

            <p className="mt-1 text-amber-500 text-lg text-center">
              {avgFeeling < 1.5
                ? "☹️"
                : avgFeeling < 2.5
                ? "😐"
                : avgFeeling < 3.5
                ? "🙂"
                : "😄"}
            </p>

            {trend && (
              <p
                className={`text-sm mt-1 text-center ${
                  Number(trend) >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {Number(trend) >= 0 ? "↑" : "↓"} {trend}% vs previous 90 days
              </p>
            )}
          </>
        )}
      </div>
    );
  })}
</div>


    </div>
    
  );

}
