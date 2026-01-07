import { ChevronRight, Plus } from "lucide-react";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import ModalSheet from "./ModalSheet";
import { useUnitSystem } from "../contexts/UnitContext";
import type { GoalStat } from "../hooks/useGoalTrackingStats";
import {
  formatDirectionSentence,
  formatTargetValue,
  getActivityLabel,
  getActivityNoun,
  sortGoalsForGroup,
} from "../lib/goalDirectionUtils";
import type { GoalDirectionGroup } from "../lib/goalDirectionUtils";

type GoalDirectionSheetProps = {
  group: GoalDirectionGroup;
  onClose: () => void;
  onEditGoal: (goal: GoalStat) => void;
  onAddGoal?: () => void;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const pluralize = (word: string) => {
  if (word.endsWith("y")) return `${word.slice(0, -1)}ies`;
  if (word.endsWith("s")) return `${word}es`;
  return `${word}s`;
};

export default function GoalDirectionSheet({
  group,
  onClose,
  onEditGoal,
  onAddGoal,
}: GoalDirectionSheetProps) {
  const { unitSystem } = useUnitSystem();
  const orderedGoals = sortGoalsForGroup(group.goals);
  const activityNoun = getActivityNoun(group.activity_type);
  const cfg = ACTIVITY_TYPES[group.activity_type] ?? ACTIVITY_TYPES["any"];
  const Icon = cfg?.Icon;
  const periodLabel = capitalize(group.period);

  const handleSelectGoal = (goal: GoalStat) => {
    onEditGoal(goal);
    onClose();
  };

  return (
    <ModalSheet onClose={onClose}>
      <div className="flex items-start gap-3 mb-3">
        {Icon && <Icon size={18} strokeWidth={1.8} />}
        <div>
          <div className="font-semibold">
            {getActivityLabel(group.activity_type)} · {periodLabel}
          </div>
          <div className="text-sm text-movenotes-muted mt-1">
            {formatDirectionSentence(group, unitSystem)}
          </div>
        </div>
      </div>

      <div className="divide-y divide-movenotes-border rounded-xl border border-movenotes-border bg-white">
        {orderedGoals.map((goal) => {
          const targetText = formatTargetValue(goal, unitSystem, activityNoun);
          const metricLabel =
            goal.metric === "distance"
              ? "Distance"
              : goal.metric === "duration"
              ? "Duration"
              : capitalize(pluralize(activityNoun));

          return (
            <button
              key={goal.goal_id}
              className="w-full flex items-center justify-between p-3 text-left"
              onClick={() => handleSelectGoal(goal)}
            >
              <div>
                <div className="text-sm font-semibold">{metricLabel}</div>
                <div className="text-xs text-movenotes-muted">
                  ~{targetText} per {group.period}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-movenotes-muted" />
            </button>
          );
        })}
      </div>

      {onAddGoal && (
        <button
          className="w-full flex items-center justify-center gap-2 bg-amber-100 border border-amber-300 text-primary-text py-3 rounded-xl font-medium mt-4"
          onClick={() => {
            onClose();
            onAddGoal();
          }}
        >
          <Plus className="w-4 h-4" />
          Add measure
        </button>
      )}
    </ModalSheet>
  );
}
