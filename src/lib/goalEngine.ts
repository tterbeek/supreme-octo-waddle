// src/lib/goalEngine.ts
import type { Goal } from "../types";

export type Period = Goal["period"];

export type ActivityLike = {
  type: "run" | "ride";
  distance_km: number;
  date: string | Date;
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYear(date: Date): Date {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getPeriodRange(period: Period, now: Date = new Date()) {
  const start =
    period === "week"
      ? startOfWeek(now)
      : period === "month"
      ? startOfMonth(now)
      : startOfYear(now);

  const end = new Date(start);
  if (period === "week") {
    end.setDate(start.getDate() + 7);
  } else if (period === "month") {
    end.setMonth(start.getMonth() + 1);
  } else {
    end.setFullYear(start.getFullYear() + 1);
  }

  return { start, end };
}

function parseActivityDate(value: string | Date): Date | null {
  if (!value) return null;
  const d =
    typeof value === "string" ? new Date(value + "T00:00:00") : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getActivitiesForGoalPeriod(
  activities: ActivityLike[],
  goal: Goal,
  now: Date = new Date()
): ActivityLike[] {
  const { start, end } = getPeriodRange(goal.period, now);

  return activities.filter((a) => {
    const d = parseActivityDate(a.date);
    if (!d) return false;
    return d >= start && d < end;
  });
}

export function computeGoalProgress(
  goal: Goal,
  activities: ActivityLike[],
  now: Date = new Date()
) {
  const periodActivities = getActivitiesForGoalPeriod(activities, goal, now);

  const relevant =
    goal.activity_type === "any"
      ? periodActivities
      : periodActivities.filter((a) => a.type === goal.activity_type);

  let currentValue = 0;

  if (goal.metric === "distance") {
    currentValue = relevant.reduce(
      (sum, a) => sum + (Number(a.distance_km) || 0),
      0
    );
  } else {
    currentValue = relevant.length;
  }

  const target = Number(goal.target) || 0;

  return {
    goal,
    currentValue,
    target,
    unit: goal.metric === "distance" ? "km" : "activities",
  };
}
