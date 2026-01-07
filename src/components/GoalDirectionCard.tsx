import { ACTIVITY_TYPES } from "../config/activityTypes";
import { useUnitSystem } from "../contexts/UnitContext";
import { getPacingMessage } from "../lib/pacingMessages";
import type { GoalStat } from "../hooks/useGoalTrackingStats";
import {
  computeGroupProgressRatio,
  formatDirectionSentence,
  formatSoFarSummary,
  getActivityLabel,
} from "../lib/goalDirectionUtils";
import type { GoalDirectionGroup } from "../lib/goalDirectionUtils";

type GoalDirectionCardProps = {
  group: GoalDirectionGroup;
  goalHistoryDots: Record<string, Array<number | null>>;
  onClick: () => void;
};

export default function GoalDirectionCard({
  group,
  goalHistoryDots,
  onClick,
}: GoalDirectionCardProps) {
  const { unitSystem } = useUnitSystem();
  const cfg = ACTIVITY_TYPES[group.activity_type] ?? ACTIVITY_TYPES["any"];
  const Icon = cfg?.Icon;

  const directionSentence = formatDirectionSentence(group, unitSystem);
  const soFarSummary = formatSoFarSummary(group, unitSystem);

  const ratio = computeGroupProgressRatio(group);

  const dotGoal = group.dotGoal || group.goals[0];
  const dotStates = dotGoal ? goalHistoryDots[dotGoal.goal_id] || [] : [];
  const hasDots = dotGoal && dotStates.length > 0;
  const dotMetricLabel =
    dotGoal?.metric === "distance"
      ? "distance"
      : dotGoal?.metric === "duration"
      ? "duration"
      : dotGoal?.activity_type === "any"
      ? "sessions"
      : "count";

  const messageSeed = `${group.activity_type}-${group.period}-${group.goals
    .map((g: GoalStat) => g.goal_id)
    .join("-")}`;
  const dailySeed = `${messageSeed}-${new Date().toISOString().slice(0, 10)}`;
  const pacingMessage = getPacingMessage(ratio, group.period, dailySeed);

  const renderDot = (state: number | null | undefined, idx: number) => {
    if (state === 2) {
      return (
        <span
          key={`${dotGoal?.goal_id || "dot"}-${idx}`}
          className="w-3.5 h-3.5 rounded-full bg-movenotes-primary"
        />
      );
    }

    if (state === 1) {
      return (
        <span
          key={`${dotGoal?.goal_id || "dot"}-${idx}`}
          className="relative w-3.5 h-3.5 rounded-full overflow-hidden border border-movenotes-border bg-movenotes-border"
        >
          <span className="absolute inset-y-0 left-0 w-1/2 bg-movenotes-primary" />
        </span>
      );
    }

    return (
      <span
        key={`${dotGoal?.goal_id || "dot"}-${idx}`}
        className="w-3.5 h-3.5 rounded-full border border-movenotes-border"
      />
    );
  };

  const showPacing = group.period !== "year" && Boolean(pacingMessage);
  const showHistory = group.period !== "year" && hasDots;

  return (
    <div
      className="relative p-4 rounded-xl border border-movenotes-border bg-movenotes-surface shadow-sm mb-3 cursor-pointer transition active:scale-[0.99]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={20} strokeWidth={1.8} />}
        <div className="flex items-center gap-2 text-base font-medium">
          <span>{getActivityLabel(group.activity_type)}</span>
          <span className="text-movenotes-muted font-normal">·</span>
          <span className="capitalize">
            {group.period}
          </span>
        </div>
      </div>

      <div className="text-base mb-1">{directionSentence}</div>
      <div className="text-base mt-1">{soFarSummary}</div>

      {showPacing && pacingMessage && (
        <p className="text-sm text-movenotes-muted mt-2">{pacingMessage}</p>
      )}

      {showHistory && (
        <div className="mt-3">
          <div className="text-sm text-movenotes-muted mb-1">
            {`Recent ${group.period}s (${dotMetricLabel}), since last update`}
          </div>
          <div className="flex gap-3.5">
            {dotStates.slice(0, 5).map((state, idx) => renderDot(state, idx))}
          </div>
        </div>
      )}
    </div>
  );
}
