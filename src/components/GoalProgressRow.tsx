// src/components/GoalProgressRow.tsx
import type { ReactNode } from "react";

interface GoalProgressRowProps {
  label: ReactNode;
  current: number;            // numeric value (km or count)
  target?: number | null;     // goal target (same unit as current)
  unit?: string;              // "km", "activities", etc.
}

export default function GoalProgressRow({
  label,
  current,
  target,
  unit,
}: GoalProgressRowProps) {
  const hasGoal = !!target && target > 0;

  const progress = hasGoal ? Math.min(1, current / (target as number)) : 0;
  const filledDots = hasGoal ? Math.floor(progress * 5) : 0;

  return (
    <div className="mb-3">
      <div className="text-sm text-gray-700 font-medium">{label}</div>

      {hasGoal ? (
        <>
          <div className="text-sm text-gray-800">
            {current.toFixed(0)} / {target} {unit ?? ""}
          </div>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i < filledDots ? "bg-movenotes-accent" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-xs text-gray-400">
          {current.toFixed(0)} {unit ?? ""} (no goal set)
        </div>
      )}
    </div>
  );
}
