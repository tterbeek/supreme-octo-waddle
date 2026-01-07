import { ACTIVITY_TYPES } from "../config/activityTypes";
import type { Goal } from "../types";
import { computeGoalProgress } from "../lib/goalEngine";
import { useUnitSystem } from "../contexts/UnitContext";
import { formatDistance } from "../lib/units";
import { getPacingMessage } from "../lib/pacingMessages";

type ActivityForProgress = {
  type: string;
  distance_km?: number | null;
  duration_min?: number | null;
  date?: string | Date;
};

type GoalProgressCardProps = {
  goal: any; // supports RPC rows and legacy Goal objects
  activities?: ActivityForProgress[];
  onClick?: () => void;
};

export default function GoalProgressCard({
  goal,
  activities,
  onClick,
}: GoalProgressCardProps) {
  const { unitSystem } = useUnitSystem();
  const cfg = ACTIVITY_TYPES[goal.activity_type] ?? ACTIVITY_TYPES["any"];
  const Icon = cfg?.Icon;
  const clickable = typeof onClick === "function";

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

  const pluralize = (word: string, value: number) => {
    if (value === 1) return word;
    if (word.endsWith("y")) return `${word.slice(0, -1)}ies`;
    if (word.endsWith("s")) return `${word}es`;
    return `${word}s`;
  };

  const periodLabel = goal.period ? goal.period.toLowerCase() : "period";
  const activityLabel =
    goal.activity_type && goal.activity_type !== "any"
      ? (cfg?.label || "activity").toLowerCase()
      : "activity";

  const formattedTarget =
    metric === "distance"
      ? formatDistance(target, unitSystem)
      : metric === "duration"
      ? `${target} min`
      : `${target} ${pluralize(activityLabel, target)}`;

  const formattedProgress =
    metric === "distance"
      ? formatDistance(progress, unitSystem)
      : metric === "duration"
      ? `${progress} min`
      : `${progress} ${pluralize(activityLabel, progress)}`;

  const targetLine = goal.period
    ? `Target this ${periodLabel}: ~${formattedTarget}`
    : `Target: ~${formattedTarget}`;

  const progressLine = goal.period
    ? `So far this ${periodLabel}: ${formattedProgress}`
    : `Progress so far: ${formattedProgress}`;

  const messageSeed =
    (goal.id as string) ||
    (goal.goal_id as string) ||
    (goal.name as string) ||
    (goal.activity_type as string) ||
    "goal";
  const dailySeed = `${messageSeed}-${new Date().toISOString().slice(0, 10)}`;

  const pacingMessage = getPacingMessage(
    target > 0 ? progress / target : 0,
    goal.period,
    dailySeed
  );

  return (
    <div
      className={`relative p-4 rounded-xl border border-movenotes-border bg-movenotes-surface shadow-sm mb-3 ${
        clickable ? "cursor-pointer transition active:scale-[0.99]" : ""
      }`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={20} strokeWidth={1.8} />}
          <span className="font-medium">
            {goal.name || cfg?.label || "Goal"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {goal.period && (
            <span className="text-xs text-movenotes-muted capitalize relative top-[2px]">
              {goal.period}
            </span>
          )}
        </div>
      </div>

      <div className="text-sm">{targetLine}</div>
      <div className="text-sm font-medium mt-1">{progressLine}</div>

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
