import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function StatsPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .order("date", { ascending: false });

      setActivities(data || []);

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
  const avg = (arr: number[]) => arr.length ? sum(arr) / arr.length : 0;

  const group = (filterFn: (a: any) => boolean) => {
    const filtered = activities.filter(filterFn);
    return {
      run: filtered.filter(a => a.type === "run"),
      ride: filtered.filter(a => a.type === "ride")
    };
  };

  const now = new Date();

  // Week ranges
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);

  const currentWeek = group(a => new Date(a.date) >= weekStart);
  const previousWeek = group(a => new Date(a.date) >= prevWeekStart && new Date(a.date) < prevWeekEnd);

  // Month ranges
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = monthStart;

  const currentMonth = group(a => new Date(a.date) >= monthStart);
  const previousMonth = group(a => new Date(a.date) >= prevMonthStart && new Date(a.date) < prevMonthEnd);

  // Rolling 90 days
  const days90Ago = new Date(now); days90Ago.setDate(now.getDate() - 90);
  const days180Ago = new Date(days90Ago); days180Ago.setDate(days90Ago.getDate() - 90);

  const current90 = group(a => new Date(a.date) >= days90Ago);
  const previous90 = group(a => new Date(a.date) >= days180Ago && new Date(a.date) < days90Ago);

  // Year-to-date block data
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const currentYear = group(a => new Date(a.date) >= yearStart);

  // Pull goals
  const getGoal = (type: "run" | "ride", period: "week" | "month" | "year") =>
    goals.find(g => g.type === type && g.period === period);

  const makeGoalRow = (
    label: string,
    currentArr: any[],
    previousArr: any[],
    goal: any,
    periodLabel: string
  ) => {
    const currentDist = sum(currentArr.map(a => a.distance_km));
    const prevDist = sum(previousArr.map(a => a.distance_km));

    return (
      <div className="mb-4">
        <div className="font-medium text-gray-700">{label}</div>

        {goal && (
          <>
            <div className="text-sm text-gray-800">
              Goal: {Math.round(currentDist)} / {goal.distance_km} km
            </div>

            <div className="flex gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < Math.min(5, Math.floor((currentDist / goal.distance_km) * 5))
                      ? "bg-amber-400"
                      : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {previousArr.length === 0 ? (
          <div className="text-xs text-gray-400 mt-1">Not enough data yet</div>
        ) : (
          <div className="text-xs text-gray-600 mt-1">
            Last {periodLabel}: {prevDist.toFixed(0)} km{" "}
            {goal && prevDist > 0 && (
              <>
                {currentDist > prevDist ? (
                  <span className="text-green-600">↑ {((currentDist / prevDist - 1) * 100).toFixed(0)}%</span>
                ) : currentDist < prevDist ? (
                  <span className="text-red-600">↓ {((currentDist / prevDist - 1) * 100).toFixed(0)}%</span>
                ) : (
                  "(same)"
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

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
      {makeGoalRow("RUN", currentWeek.run, previousWeek.run, getGoal("run", "week"), "week")}
      {makeGoalRow("RIDE", currentWeek.ride, previousWeek.ride, getGoal("ride", "week"), "week")}

      {/* MONTH */}
<h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
  MONTH
</h2>      
      {makeGoalRow("RUN", currentMonth.run, previousMonth.run, getGoal("run", "month"), "month")}
      {makeGoalRow("RIDE", currentMonth.ride, previousMonth.ride, getGoal("ride", "month"), "month")}

      {/* YEAR */}
<h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
  YEAR
</h2>
      {makeGoalRow("RUN", currentYear.run, [], getGoal("run", "year"), "")}
      {makeGoalRow("RIDE", currentYear.ride, [], getGoal("ride", "year"), "")}

      {/* ROLLING 90 DAYS */}
<h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
  ROLLING 90 DAYS
</h2>
      {(["run", "ride"] as const).map(type => {
        const curr = current90[type];
        const prev = previous90[type];

        return (
          <div key={type} className="mb-4">
            <div className="font-medium text-gray-700">{type.toUpperCase()}</div>

            {prev.length === 0 ? (
              <div className="text-xs text-gray-400 mt-1">Not enough data yet</div>
            ) : (
              <>
                <div className="text-sm text-gray-800">
                  Total: {sum(curr.map(a => a.distance_km)).toFixed(0)} km
                </div>
                <div className="text-sm text-gray-600">
                  Avg: {avg(curr.map(a => a.distance_km)).toFixed(1)} km
                </div>
                <div className="text-sm text-gray-600">
                  Avg feeling:
                  <span className="ml-1 text-amber-400">
                    {"★".repeat(Math.round(avg(curr.map(a => a.feeling))))}
                  </span>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* THIS YEAR TOTALS */}
<h2 className="text-lg font-bold text-amber-600 tracking-wide mt-8 mb-3 border-b border-amber-300/50 pb-1">
  THIS YEAR'S TOTAL
</h2>
      <div className="text-sm ml-2">
        <div className="mb-2">
          <span className="font-medium">RUN:</span> {sum(currentYear.run.map(a => a.distance_km)).toFixed(0)} km · {currentYear.run.length} activities
        </div>
        <div>
          <span className="font-medium">RIDE:</span> {sum(currentYear.ride.map(a => a.distance_km)).toFixed(0)} km · {currentYear.ride.length} activities
        </div>
      </div>
    </div>
  );
}
