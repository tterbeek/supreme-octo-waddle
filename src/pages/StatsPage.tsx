// src/pages/StatsPage.tsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import HeaderLogo from "../components/HeaderLogo";
import { Bike, Footprints, Frown, Meh, Laugh, Smile } from "lucide-react";

import type { Goal } from "../types";
import GoalProgressCard from "../components/GoalProgressCard";
import {
  computeGoalComparison,
  parseActivityDate,
  sumDistance,
} from "../lib/goalEngine";

export default function StatsPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // --------------------------------------------------
  // LOAD ACTIVITIES + GOALS (same as homepage)
  // --------------------------------------------------
  useEffect(() => {
    const load = async () => {
      const { data: acts } = await supabase
        .from("activities")
        .select("*")
        .order("date", { ascending: false });
      setActivities(acts || []);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: g } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id);
      setGoals(g || []);
    };
    load();
  }, []);

  // --------------------------------------------------
  // GROUP GOALS BY PERIOD
  // --------------------------------------------------
  const weeklyGoals = goals.filter((g) => g.period === "week");
  const monthlyGoals = goals.filter((g) => g.period === "month");
  const yearlyGoals = goals.filter((g) => g.period === "year");

  // --------------------------------------------------
  // REUSABLE GOAL SECTION
  // --------------------------------------------------
  const GoalSection = ({ title, items }: { title: string; items: Goal[] }) => {
    if (items.length === 0) return null;

    return (
      <>
        <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
          {title}
        </h2>

        <div className="flex flex-col gap-4">
          {items.map((g) => {
            const comparison =
              g.metric === "distance"
                ? computeGoalComparison(g, activities)
                : null;

            return (
              <div key={g.id}>
                <GoalProgressCard goal={g} activities={activities} />

                {comparison !== null && (
                  <p
                    className={`text-sm mt-1 ml-1 ${
                      comparison >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {comparison >= 0 ? "↑" : "↓"} {comparison}% vs previous
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-movenotes-bg p-2">
      <div className="p-2 max-w-md mx-auto">
  <div className="mb-4">
  <h1 className="text-lg font-bold text-gray-600 text-center">
    Stats
  </h1>
</div>

        {/* -------------------------------------------------- */}
        {/* GOALS (Unified Engine) */}
        {/* -------------------------------------------------- */}
        <GoalSection title="WEEK" items={weeklyGoals} />
        <GoalSection title="MONTH" items={monthlyGoals} />
        <GoalSection title="YEAR" items={yearlyGoals} />

        {/* -------------------------------------------------- */}
        {/* LAST 90 DAYS TREND (using unified helpers) */}
        {/* -------------------------------------------------- */}
        <h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
          LAST 90 DAYS TREND
        </h2>

        <div className="flex flex-col gap-4">
          {(["run", "ride"] as const).map((type) => {
            const now = new Date();

            const days90Ago = new Date(now);
            days90Ago.setDate(days90Ago.getDate() - 90);

            const days180Ago = new Date(now);
            days180Ago.setDate(days180Ago.getDate() - 180);

            const inRange = (date: Date, start: Date, end: Date) =>
              date >= start && date < end;

            const typeActs = activities.filter((a) => a.type === type);

            const current90 = typeActs.filter((a) => {
              const d = parseActivityDate(a.date);
              return inRange(d, days90Ago, now);
            });

            const previous90 = typeActs.filter((a) => {
              const d = parseActivityDate(a.date);
              return inRange(d, days180Ago, days90Ago);
            });

            const currDist = sumDistance(current90);
            const prevDist = sumDistance(previous90);

            const trend =
              prevDist > 0
                ? Math.round((currDist / prevDist - 1) * 100)
                : null;

            const avgFeeling =
              current90.length > 0
                ? current90.reduce(
                    (t, a) => t + (a.feeling || 0),
                    0
                  ) / current90.length
                : 0;

            const hasData = current90.length > 0;

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
                  <p className="text-sm text-gray-500 italic">
                    Not enough data yet
                  </p>
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

                    {trend !== null && (
                      <p
                        className={`text-sm mt-2 text-center ${
                          trend >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {trend >= 0 ? "↑" : "↓"} {trend}% vs previous 90 days
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
