// src/lib/goalEngine.ts
import type { Goal } from "../types";

export type ActivityLike = {
  type: "run" | "ride";
  distance_km: number;
  date: string | Date;
};

// --------------------------------------------------------
// PERIOD HELPERS
// --------------------------------------------------------

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

export function getPeriodRange(period: Goal["period"], now = new Date()) {
  let start: Date;

  if (period === "week") start = startOfWeek(now);
  else if (period === "month") start = startOfMonth(now);
  else start = startOfYear(now);

  const end = new Date(start);

  if (period === "week") end.setDate(start.getDate() + 7);
  else if (period === "month") end.setMonth(start.getMonth() + 1);
  else end.setFullYear(start.getFullYear() + 1);

  return { start, end };
}

// --------------------------------------------------------
// ACTIVITY FILTERING
// --------------------------------------------------------

function parseDate(d: string | Date) {
  return typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
}

export function getActivitiesForGoalPeriod(
  activities: ActivityLike[],
  goal: Goal,
  now = new Date()
) {
  const { start, end } = getPeriodRange(goal.period, now);

  return activities.filter((a) => {
    const date = parseDate(a.date);
    return date >= start && date < end;
  });
}

// --------------------------------------------------------
// MAIN: COMPUTE PROGRESS (CURRENT PERIOD)
// --------------------------------------------------------

export function computeGoalProgress(goal: Goal, activities: ActivityLike[]) {
  const periodActs = getActivitiesForGoalPeriod(activities, goal);

  const relevant =
    goal.activity_type === "any"
      ? periodActs
      : periodActs.filter((a) => a.type === goal.activity_type);

  const raw =
    goal.metric === "distance"
      ? relevant.reduce((sum, a) => sum + Number(a.distance_km || 0), 0)
      : relevant.length;

  const currentValue = Math.round(raw);           // rounded
  const target = Math.round(Number(goal.target)); // rounded

  const ratio = target > 0 ? Math.min(1, currentValue / target) : 0;

  return {
    goal,
    currentValue,
    target,
    unit: goal.metric === "distance" ? "km" : "activities",
    ratio,
  };
}

// --------------------------------------------------------
// NEW: COMPUTE COMPARISON (LAST COMPLETED PERIOD VS PREVIOUS)
// --------------------------------------------------------

// Helper: move a date back by 1 or 2 periods
function shiftDateBackByPeriod(
  date: Date,
  period: Goal["period"],
  steps: number
) {
  const d = new Date(date);
  if (period === "week") {
    d.setDate(d.getDate() - 7 * steps);
  } else if (period === "month") {
    d.setMonth(d.getMonth() - steps);
  } else {
    d.setFullYear(d.getFullYear() - steps);
  }
  return d;
}

export function computeGoalComparison(
  goal: Goal,
  activities: ActivityLike[],
  now = new Date()
): number | null {
  // Only makes sense for distance goals
  if (goal.metric !== "distance") return null;

  // LAST COMPLETED period (the one *before* the current period)
  const lastRef = shiftDateBackByPeriod(now, goal.period, 1);
  const { start: lastStart, end: lastEnd } = getPeriodRange(goal.period, lastRef);

  // PERIOD BEFORE THAT
  const beforeRef = shiftDateBackByPeriod(now, goal.period, 2);
  const { start: beforeStart, end: beforeEnd } = getPeriodRange(
    goal.period,
    beforeRef
  );

  const isRelevantType = (a: ActivityLike) =>
    goal.activity_type === "any" ? true : a.type === goal.activity_type;

  const inRange = (a: ActivityLike, s: Date, e: Date) => {
    const d = parseDate(a.date);
    return d >= s && d < e;
  };

  const lastActs = activities.filter(
    (a) => isRelevantType(a) && inRange(a, lastStart, lastEnd)
  );
  const beforeActs = activities.filter(
    (a) => isRelevantType(a) && inRange(a, beforeStart, beforeEnd)
  );

  const sumDistance = (arr: ActivityLike[]) =>
    arr.reduce((sum, a) => sum + Number(a.distance_km || 0), 0);

  const lastTotal = sumDistance(lastActs);
  const beforeTotal = sumDistance(beforeActs);

  if (beforeTotal <= 0) return null; // no baseline to compare

  const ratio = lastTotal / beforeTotal;
  const pct = (ratio - 1) * 100;

  return Math.round(pct); // rounded percent change
}

// --------------------------------------------------------
// GENERIC HELPERS (used by 90-day trend, etc.)
// --------------------------------------------------------

// Reuse parseDate internally
export function parseActivityDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
}

export function sumDistance(acts: ActivityLike[]): number {
  return acts.reduce((sum, a) => sum + Number(a.distance_km || 0), 0);
}
