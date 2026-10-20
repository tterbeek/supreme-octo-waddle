import type { CompanionGoal } from "./companion.ts";

export type DirectionActivity = {
  type: string; date: string; distance_km: number | null; duration_min: number | null;
};
export type DirectionProgress = {
  activity_type: string;
  metric: "distance" | "duration" | "count";
  unit: "km" | "min" | "activities";
  period: "week" | "month" | "year";
  period_start: string;
  period_end: string;
  target: number;
  actual: number;
  remaining: number;
  as_of: string;
};

/** Activities use calendar dates; the reflected week is already resolved in the
 * person's saved time zone. UTC calendar arithmetic avoids host/DST shifts. */
export function directionPeriodRange(period: string, asOf: string) {
  const day = new Date(`${asOf}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== asOf) throw new Error("Invalid Direction cutoff.");
  const start = new Date(day);
  const end = new Date(day);
  if (period === "week") {
    start.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
    end.setTime(start.getTime()); end.setUTCDate(start.getUTCDate() + 6);
  } else if (period === "month") {
    start.setUTCDate(1);
    end.setUTCMonth(day.getUTCMonth() + 1, 0);
  } else if (period === "year") {
    start.setUTCMonth(0, 1); end.setUTCMonth(11, 31);
  } else throw new Error("Unsupported Direction period.");
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function emptyProgress(goal: CompanionGoal, asOf: string): DirectionProgress {
  const range = directionPeriodRange(goal.period, asOf);
  if (!["distance", "duration", "count"].includes(goal.metric) || !Number.isFinite(Number(goal.target)) || Number(goal.target) < 0) throw new Error("Invalid Direction.");
  return {
    activity_type: goal.activity_type, metric: goal.metric as DirectionProgress["metric"],
    period: goal.period as DirectionProgress["period"], unit: goal.metric === "distance" ? "km" : goal.metric === "duration" ? "min" : "activities",
    period_start: range.start, period_end: range.end, target: Number(goal.target), actual: 0,
    remaining: Number(goal.target), as_of: asOf,
  };
}

function accumulate(progress: DirectionProgress[], activities: DirectionActivity[]) {
  for (const activity of activities) for (const item of progress) {
    if (activity.date < item.period_start || activity.date > item.as_of || activity.date > item.period_end || (item.activity_type !== "any" && item.activity_type !== activity.type)) continue;
    const value = item.metric === "count" ? 1 : Number((item.metric === "distance" ? activity.distance_km : activity.duration_min) ?? 0);
    if (!Number.isFinite(value)) throw new Error("Invalid activity metric.");
    item.actual += value;
  }
}
function finish(progress: DirectionProgress[]) {
  return progress.map(item => ({ ...item, actual: Number(item.actual.toFixed(6)), remaining: Number(Math.max(0, item.target - item.actual).toFixed(6)) }));
}

export function calculateDirectionProgress(goals: CompanionGoal[], activities: DirectionActivity[], asOf: string) {
  const progress = goals.map(goal => emptyProgress(goal, asOf));
  accumulate(progress, activities);
  return finish(progress);
}

/** Read only numeric activity fields, in complete pages, independently of the
 * weekly narrative limit. Never send raw month/year history to the provider. */
export async function loadDirectionProgress(goals: CompanionGoal[], asOf: string, readPage: (page: {
  start: string; end: string; offset: number; limit: number;
}) => PromiseLike<{ data: DirectionActivity[] | null; error: unknown }>) {
  const progress = goals.map(goal => emptyProgress(goal, asOf));
  if (!progress.length) return [];
  const start = progress.map(item => item.period_start).sort()[0];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await readPage({ start, end: asOf, offset, limit });
    if (error || !data) throw new Error("Couldn't calculate Direction progress.");
    accumulate(progress, data);
    if (data.length < limit) break;
  }
  return finish(progress);
}
