import { ACTIVITY_TYPES } from "../config/activityTypes";
import type { GoalStat } from "../hooks/useGoalTrackingStats";
import type { UnitSystem } from "./units";
import { formatDistance } from "./units";

export type GoalDirectionGroup = {
  activity_type: GoalStat["activity_type"];
  period: GoalStat["period"];
  goals: GoalStat[];
  dotGoal?: GoalStat;
};

const METRIC_ORDER: Record<GoalStat["metric"], number> = {
  distance: 1,
  duration: 2,
  count: 3,
};

const pluralize = (word: string, value: number) => {
  if (value === 1) return word;
  if (word.endsWith("y")) return `${word.slice(0, -1)}ies`;
  if (word.endsWith("s")) return `${word}es`;
  return `${word}s`;
};

export const sortGoalsForGroup = (goals: GoalStat[]) =>
  goals.slice().sort((a, b) => METRIC_ORDER[a.metric] - METRIC_ORDER[b.metric]);

export const normalizeGoalValues = (goal: GoalStat) => {
  const targetRaw = Number(goal.target ?? 0) || 0;
  const progressRaw = Number(goal.current_value ?? 0) || 0;

  let target =
    goal.metric === "distance" ? Math.round(targetRaw) : targetRaw;
  let progress =
    goal.metric === "distance" ? Math.round(progressRaw) : progressRaw;

  if (goal.metric === "count") {
    target = Math.max(0, Math.floor(targetRaw));
    progress = Math.max(0, Math.floor(progressRaw));
    const ratio = Number(goal.progress_ratio ?? 0) || 0;
    if (ratio <= 0 && progress > 0) {
      progress = 0;
    }
  }

  const ratio = target > 0 ? progress / target : 0;

  return { target, progress, ratio };
};

export const pickPreferredMetricGoal = (group: GoalDirectionGroup) => {
  const ordered = sortGoalsForGroup(group.goals);
  const distance = ordered.find((g) => g.metric === "distance");
  if (distance) return distance;
  const duration = ordered.find((g) => g.metric === "duration");
  if (duration) return duration;
  const count = ordered.find((g) => g.metric === "count");
  if (count) return count;
  return ordered[0];
};

export const getActivityLabel = (activityType: string) => {
  const cfg = ACTIVITY_TYPES[activityType] ?? ACTIVITY_TYPES["any"];
  return cfg?.label || "Activity";
};

export const getActivityNoun = (activityType: string) =>
  (getActivityLabel(activityType) || "activity").toLowerCase();

const getCountNoun = (activityType: string, fallback?: string) => {
  if (activityType === "any") return "session";
  return (fallback || getActivityNoun(activityType) || "activity").toLowerCase();
};

export const formatTargetValue = (
  goal: GoalStat,
  unitSystem: UnitSystem,
  activityNoun?: string
) => {
  const { target } = normalizeGoalValues(goal);
  if (goal.metric === "distance") return formatDistance(target, unitSystem);
  if (goal.metric === "duration") return `${target} min`;
  const noun = getCountNoun(goal.activity_type, activityNoun);
  return `${target} ${pluralize(noun, target)}`;
};

export const formatProgressValue = (
  goal: GoalStat,
  unitSystem: UnitSystem,
  activityNoun?: string
) => {
  const { progress } = normalizeGoalValues(goal);
  if (goal.metric === "distance") return formatDistance(progress, unitSystem);
  if (goal.metric === "duration") return `${progress} min`;
  const noun = getCountNoun(goal.activity_type, activityNoun);
  return `${progress} ${pluralize(noun, progress)}`;
};

export const formatDirectionSentence = (
  group: GoalDirectionGroup,
  unitSystem: UnitSystem
) => {
  const ordered = sortGoalsForGroup(group.goals);
  const activityNoun = getActivityNoun(group.activity_type);
  const distanceGoal = ordered.find((g) => g.metric === "distance");
  const durationGoal = ordered.find((g) => g.metric === "duration");
  const countGoal = ordered.find((g) => g.metric === "count");

  const distanceText = distanceGoal
    ? formatTargetValue(distanceGoal, unitSystem, activityNoun)
    : null;
  const durationText = durationGoal
    ? formatTargetValue(durationGoal, unitSystem, activityNoun)
    : null;
  const countText = countGoal
    ? formatTargetValue(countGoal, unitSystem, activityNoun)
    : null;

  const amountParts = [distanceText, durationText].filter(Boolean);

  let base =
    amountParts.length === 2
      ? `Around ${amountParts[0]} or ${amountParts[1]}`
      : amountParts.length === 1
      ? `Around ${amountParts[0]}`
      : "";

  if (countText) {
    base = base
      ? `${base} in about ${countText}`
      : `Around ${countText}`;
  }

  return base || "Around this goal";
};

export const formatSoFarSummary = (
  group: GoalDirectionGroup,
  unitSystem: UnitSystem
) => {
  const ordered = sortGoalsForGroup(group.goals);
  const activityNoun = getActivityNoun(group.activity_type);
  const pieces = ordered.map((goal) =>
    formatProgressValue(goal, unitSystem, activityNoun)
  );

  const prefix = "So far:";

  return pieces.length ? `${prefix} ${pieces.join(", ")}` : prefix;
};

export const computeGroupProgressRatio = (group: GoalDirectionGroup) => {
  const ratios = group.goals.map((g) => normalizeGoalValues(g).ratio);
  if (!ratios.length) return 0;
  const sum = ratios.reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0);
  return sum / ratios.length;
};
