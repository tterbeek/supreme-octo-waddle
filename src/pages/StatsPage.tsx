import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import HeaderLogo from "../components/HeaderLogo";
import {
  Bike,
  Footprints,
  Target,
  Hash,
  Frown,
  Meh,
  Laugh,
  Smile
} from "lucide-react";
import type { Goal } from "../types";

export default function StatsPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

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
  const now = new Date();

  const parseDate = (value: string | Date) => {
    const d = typeof value === "string"
      ? new Date(value + "T00:00:00Z")
      : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  // Period helpers
  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const startOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1);

  // Week periods
  const currentWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const weekBeforeStart = new Date(currentWeekStart);
  weekBeforeStart.setDate(weekBeforeStart.getDate() - 14);

  const currentWeek = activities.filter((a) => parseDate(a.date)! >= currentWeekStart);
  const lastWeek = activities.filter(
    (a) =>
      parseDate(a.date)! >= lastWeekStart &&
      parseDate(a.date)! < currentWeekStart
  );
  const weekBefore = activities.filter(
    (a) =>
      parseDate(a.date)! >= weekBeforeStart &&
      parseDate(a.date)! < lastWeekStart
  );

  // Month periods
  const currentMonthStart = startOfMonth(now);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthBeforeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const currentMonth = activities.filter(
    (a) => parseDate(a.date)! >= currentMonthStart
  );
  const lastMonth = activities.filter(
    (a) =>
      parseDate(a.date)! >= lastMonthStart &&
      parseDate(a.date)! < currentMonthStart
  );
  const monthBefore = activities.filter(
    (a) =>
      parseDate(a.date)! >= monthBeforeStart &&
      parseDate(a.date)! < lastMonthStart
  );

  // Year
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const currentYear = activities.filter((a) => parseDate(a.date)! >= yearStart);

  const iconForType = (t: string) =>
    t === "run" ? Footprints : t === "ride" ? Bike : Target;

  const metricIcon = (metric: string) =>
    metric === "distance" ? Target : Hash;

  // Progress Dots (0..5)
  const ProgressDots = ({ ratio }: { ratio: number }) => (
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
  );

  // Section component reused for week/month/year
  const GoalSection = ({
    title,
    period,
    currentActs,
    lastActs,
    beforeActs,
  }: {
    title: string;
    period: Goal["period"];
    currentActs: any[];
    lastActs: any[];
    beforeActs: any[];
  }) => {
    const periodGoals = goals.filter((g) => g.period === period);

    if (periodGoals.length === 0) return null; // 🔥 hide entire block if no goals

    return (
      <>
        <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
          {title}
        </h2>

        <div className="flex flex-col gap-4">
          {periodGoals.map((g) => {
            const Icon = iconForType(g.activity_type);
            const MIcon = metricIcon(g.metric);

            const filterType = (type: string, arr: any[]) =>
              type === "any" ? arr : arr.filter((a) => a.type === type);

            const currList = filterType(g.activity_type, currentActs);
            const currDist = sum(currList.map((a) => a.distance_km));
            const currCount = currList.length;

            const lastList = filterType(g.activity_type, lastActs);
            const beforeList = filterType(g.activity_type, beforeActs);

            // distance_compare uses completed weeks/months only
            const prevDist = sum(beforeList.map((a) => a.distance_km));
            const lastDist = sum(lastList.map((a) => a.distance_km));
            const change =
              prevDist > 0 ? ((lastDist / prevDist - 1) * 100).toFixed(0) : null;

            const target = g.target;
            const value = g.metric === "distance" ? currDist : currCount;
            const ratio = target > 0 ? Math.min(1, value / target) : 0;

            return (
              <div
                key={g.id}
                className="bg-warm-100 border border-warm-200 rounded-xl p-4 shadow-sm"
              >
                {/* Title */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-gray-900" />
                  <MIcon className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
                    {g.name || `${g.activity_type} ${g.metric}`}
                  </h3>
                </div>

                {/* Value / target */}
                <div className="text-base text-gray-900 font-medium">
                  {g.metric === "distance"
                    ? `${Math.round(value)} / ${Math.round(target)} km`
                    : `${currCount} / ${target} activities`}
                </div>


                {/* Dots */}
                <ProgressDots ratio={ratio} />

                {/* Comparison (distance only) */}
                {g.metric === "distance" && change && (
                  <div
                    className={`text-sm mt-2 ${
                      Number(change) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {Number(change) >= 0 ? "↑" : "↓"} {change}% vs previous{" "}
                    {period}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-movenotes-bg p-4">
      <div className="p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/")} className="text-sm underline">
            ← Back
          </button>
          <h1 className="text-lg font-bold">Stats</h1>
          <div className="w-10" />
        </div>

        {/* WEEK */}
        <GoalSection
          title="WEEK"
          period="week"
          currentActs={currentWeek}
          lastActs={lastWeek}
          beforeActs={weekBefore}
        />

        {/* MONTH */}
        <GoalSection
          title="MONTH"
          period="month"
          currentActs={currentMonth}
          lastActs={lastMonth}
          beforeActs={monthBefore}
        />

        {/* YEAR */}
        <GoalSection
          title="YEAR"
          period="year"
          currentActs={currentYear}
          lastActs={[]} // no comparison for year
          beforeActs={[]}
        />
{/* LAST 90 DAYS TREND */}
<h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
  LAST 90 DAYS TREND
</h2>

<div className="flex flex-col gap-4">
  {(["run", "ride"] as const).map((type) => {
    const days90Ago = new Date();
    days90Ago.setDate(days90Ago.getDate() - 90);

    const days180Ago = new Date(days90Ago);
    days180Ago.setDate(days180Ago.getDate() - 90);

    const parse = (d: string) => new Date(d + "T00:00:00Z");

    const current90 = activities.filter(
      (a) => a.type === type && parse(a.date) >= days90Ago
    );

    const previous90 = activities.filter(
      (a) =>
        a.type === type &&
        parse(a.date) >= days180Ago &&
        parse(a.date) < days90Ago
    );

    const currDist = sum(current90.map((a) => a.distance_km));
    const prevDist = sum(previous90.map((a) => a.distance_km));
    const trend =
      prevDist > 0 ? ((currDist / prevDist - 1) * 100).toFixed(0) : null;

    const avgFeeling =
      current90.length > 0
        ? current90.reduce((t, a) => t + (a.feeling || 0), 0) /
          current90.length
        : 0;

    const hasData = current90.length > 0;

    // Pick Lucide feeling icon
    const FeelingIcon =
      avgFeeling <= 1.5
        ? Frown
        : avgFeeling <= 2.5
        ? Meh
        : avgFeeling <= 3.5
        ? Smile
        : Laugh;

    return (
      <div
        key={type}
        className="bg-warm-100 border border-warm-200 rounded-xl p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          {type === "run" ? (
            <Footprints className="w-5 h-5 text-gray-900" />
          ) : (
            <Bike className="w-5 h-5 text-gray-900" />
          )}
          <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
            {type.toUpperCase()}
          </h3>
        </div>

        {!hasData ? (
          <p className="text-sm text-gray-500 italic">Not enough data yet</p>
        ) : (
          <>
            <p className="text-base text-gray-900 font-medium">
              {Math.round(currDist)} km total
              <span className="text-sm text-gray-600 ml-1">
                · {Math.round(currDist / 12.9)} km / week avg
              </span>
            </p>

            <div className="flex justify-center mt-2">
              <FeelingIcon className="w-6 h-6 text-movenotes-accent" />
            </div>

            {trend && (
              <p
                className={`text-sm mt-2 text-center ${
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

      <HeaderLogo withTagline delay={0.2} />
    </div>
  );
}
