import { ACTIVITY_TYPES } from "../config/activityTypes";
import type { Goal } from "../types";
import { computeGoalProgress } from "../lib/goalEngine";

type ActivityForProgress = {
  type: string;
  distance_km?: number | null;
  duration_min?: number | null;
  date?: string | Date;
};

type GoalProgressCardProps = {
  goal: any; // supports RPC rows and legacy Goal objects
  activities?: ActivityForProgress[];
};

export default function GoalProgressCard({
  goal,
  activities,
}: GoalProgressCardProps) {
  const cfg = ACTIVITY_TYPES[goal.activity_type] ?? ACTIVITY_TYPES["any"];
  const Icon = cfg?.Icon;

  // Support multiple goal shapes: RPC rows, legacy Goal, etc.
  const targetRaw =
    Number(goal.target ?? goal.goal_target ?? goal.progress_target ?? 0) || 0;

  let progressRaw =
    Number(
      goal.progress_current ??
        goal.current_value ??
        goal.progress_value ??
        goal.currentValue ??
        0
    ) || 0;

  const ratio =
    Number(goal.progress_ratio ?? goal.progressRatio ?? 0) || 0;

  // Legacy fallback: compute from activities if not provided
  if (progressRaw === 0 && Array.isArray(activities) && goal) {
    try {
      const res = computeGoalProgress(goal as Goal, activities as any);
      progressRaw = Number(res.currentValue) || 0;
    } catch {
      // ignore compute errors
    }
  }

  const metric = goal.metric || goal.goal_metric;

  // Display values: distance rounded, count floored (no phantom 1), others raw.
  let progress =
    metric === "distance" ? Math.round(progressRaw) : progressRaw;
  let target =
    metric === "distance" ? Math.round(targetRaw) : targetRaw;

  if (metric === "count") {
    progress = Math.max(0, Math.floor(progressRaw));
    target = Math.max(0, Math.floor(targetRaw));
    if (ratio <= 0 && progress > 0) {
      // Clamp a phantom count that shouldn't exist.
      progress = 0;
    }
  }

  const filledDots = Math.max(
    0,
    Math.min(
      5,
      Math.round(((targetRaw > 0 ? progressRaw / targetRaw : 0) * 5) || 0)
    )
  );

  const valueLabel =
    metric === "distance"
      ? `${progress} km / ${target} km`
      : metric === "duration"
      ? `${progress} min / ${target} min`
      : `${progress} / ${target} ${target === 1 ? "activity" : "activities"}`;

  // ---------------- Pacing helpers ----------------
  const PACING_MESSAGES = {
    goalReached: [
      "Goal reached—great job!",
      "You hit this goal—amazing work!",
      "Target met—nicely done!",
    ],
    onTrackEarly: [
      "Nice start—keep this rhythm.",
      "Strong opening—stay steady.",
      "Good early pace—carry it forward.",
    ],
    onTrackMid: [
      "You’re right on track this period.",
      "Steady pace—looking good.",
      "Keeping pace nicely—stay consistent.",
    ],
    onTrackLate: [
      "You’re on pace to finish—keep it up.",
      "Closing in right on schedule.",
      "Steady finish—maintain this rhythm.",
    ],
    nearPaceEarly: [
      "You’re close—add a little when you can.",
      "Almost on pace—one more effort helps.",
      "Just a bit more to stay on track.",
    ],
    nearPaceLate: [
      "Close to pace—one or two efforts will do it.",
      "Nearly there—finish strong.",
      "Just a little push to stay on course.",
    ],
    gentleEarly: [
      "Early in the period—ease into it.",
      "Plenty of time—light steps are fine.",
      "A gentle start—add a bit later.",
    ],
    gentleLate: [
      "Still time to add a small effort.",
      "A little movement now will help you finish.",
      "A short session keeps momentum alive.",
    ],
  };

  const pickMessage = (list: string[]) =>
    list[Math.floor(Math.random() * list.length)];

  const startOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // Monday = 0
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const startOfMonth = (d: Date) => {
    const date = new Date(d.getFullYear(), d.getMonth(), 1);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const startOfYear = (d: Date) => {
    const date = new Date(d.getFullYear(), 0, 1);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getPeriodElapsedRatio = (
    period?: "week" | "month" | "year",
    now = new Date()
  ) => {
    if (!period) return 1;
    const start =
      period === "week"
        ? startOfWeek(now)
        : period === "month"
        ? startOfMonth(now)
        : startOfYear(now);
    const end = new Date(start);
    if (period === "week") end.setDate(start.getDate() + 7);
    else if (period === "month") end.setMonth(start.getMonth() + 1);
    else end.setFullYear(start.getFullYear() + 1);

    const total = end.getTime() - start.getTime();
    const elapsed = Math.max(
      0,
      Math.min(total, now.getTime() - start.getTime())
    );
    return total > 0 ? elapsed / total : 1;
  };

  const getPacingMessage = (
    ratio: number,
    period?: "week" | "month" | "year"
  ) => {
    if (!period) return null;
    if (ratio >= 1) return pickMessage(PACING_MESSAGES.goalReached);

    const elapsed = getPeriodElapsedRatio(period);
    const early = elapsed < 0.33;
    const late = elapsed > 0.66;

    if (ratio >= elapsed * 0.9) {
      if (early) return pickMessage(PACING_MESSAGES.onTrackEarly);
      if (late) return pickMessage(PACING_MESSAGES.onTrackLate);
      return pickMessage(PACING_MESSAGES.onTrackMid);
    }

    if (ratio >= elapsed * 0.6) {
      return late
        ? pickMessage(PACING_MESSAGES.nearPaceLate)
        : pickMessage(PACING_MESSAGES.nearPaceEarly);
    }

    return late
      ? pickMessage(PACING_MESSAGES.gentleLate)
      : pickMessage(PACING_MESSAGES.gentleEarly);
  };

  const pacingMessage = getPacingMessage(
    target > 0 ? progress / target : 0,
    goal.period
  );

  return (
    <div className="p-4 rounded-xl border border-movenotes-border bg-movenotes-surface shadow-sm mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={20} strokeWidth={1.8} />}
          <span className="font-medium">
            {goal.name || cfg?.label || "Goal"}
          </span>
        </div>
        {goal.period && (
          <span className="text-xs text-movenotes-muted capitalize">
            {goal.period}
          </span>
        )}
      </div>

      <div className="text-lg font-semibold mb-1">{valueLabel}</div>

      <div className="flex gap-1 mt-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < filledDots ? "bg-movenotes-primary" : "bg-movenotes-border"
            }`}
          />
        ))}
      </div>

      {pacingMessage && (
        <p className="text-xs text-movenotes-muted mt-1">{pacingMessage}</p>
      )}
    </div>
  );
}
