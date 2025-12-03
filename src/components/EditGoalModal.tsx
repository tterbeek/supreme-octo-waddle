// src/components/EditGoalModal.tsx
import { useState } from "react";
import ModalSheet from "./ModalSheet";
import { supabase } from "../supabaseClient";
import type { Goal } from "../types";
import { Bike, Footprints, Target, CalendarDays, Ruler, Hash } from "lucide-react";
import { ACTIVITY_TYPES } from "../config/activityTypes";

interface EditGoalModalProps {
  goal: Goal;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: (id: string) => void;
}

export default function EditGoalModal({
  goal,
  onClose,
  onUpdated,
  onDeleted,
}: EditGoalModalProps) {
  const [target, setTarget] = useState(String(goal.target));
  const [name, setName] = useState(goal.name || "");
  const [metric, setMetric] = useState<Goal["metric"] | "duration">(
    (goal.metric as Goal["metric"] | "duration") || "count"
  );
  const [saving, setSaving] = useState(false);
  const safeActivityType = goal.activity_type || "any";
  const typeConfig = ACTIVITY_TYPES[safeActivityType] ?? ACTIVITY_TYPES["any"];

  const save = async () => {
    setSaving(true);

    await supabase
      .from("goals")
      .update({
        metric,
        target: Number(target),
        name: name.trim() || goal.name,
      })
      .eq("id", goal.id);

    setSaving(false);
    onUpdated();
    onClose();
  };

  const del = async () => {
    await supabase.from("goals").delete().eq("id", goal.id);
    onDeleted(goal.id);
    onClose();
  };

  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold text-center mb-4">Edit Goal</h2>

{/* Display type / period with icons */}
<div className="flex flex-col gap-3 mb-4 text-gray-700">

  {/* Activity type */}
  <div className="flex items-center gap-2">
    {(() => {
      const Icon = typeConfig?.Icon;
      return Icon ? <Icon size={18} /> : <Target className="w-5 h-5" />;
    })()}

    <span className="font-medium">
      Activity: {typeConfig?.label || goal.activity_type}
    </span>
  </div>

  {/* Period — ALWAYS CalendarDays */}
  <div className="flex items-center gap-2">
    <CalendarDays className="w-5 h-5" />
    <span className="font-medium capitalize">
      Period: {goal.period}
    </span>
  </div>

  {/* Metric (distance / count / duration) */}
  <div className="flex items-center gap-2">
    {metric === "distance" && <Ruler className="w-5 h-5" />}
    {metric === "count" && <Hash className="w-5 h-5" />}
    {metric === "duration" && <Target className="w-5 h-5" />}

    <span className="font-medium">
      Metric: {metric}
    </span>
  </div>
</div>


      {/* Metric selector (view-only per requirements) */}
      <label className="block text-sm mb-1">Metric</label>
      <div className="flex gap-2 mb-3">
        {(() => {
          let metricsForType: Array<Goal["metric"] | "duration"> = [];
          if (safeActivityType === "any") {
            metricsForType = ["count"];
          } else {
            if (typeConfig?.defaultFields.includes("distance_km")) metricsForType.push("distance");
            if (typeConfig?.defaultFields.includes("duration_min"))
              metricsForType.push("duration" as Goal["metric"]);
            metricsForType.push("count");
          }
          if (metricsForType.length === 0) {
            metricsForType = ["count"];
          }
          return metricsForType.map((m) => (
            <button
              key={m}
              type="button"
              disabled
              className={`px-3 py-2 rounded-md border opacity-50 ${
                metric === m ? "bg-amber-200 border-amber-400" : "bg-white border-gray-300"
              }`}
            >
              {m === "distance" && "Distance"}
              {m === "duration" && "Duration"}
              {m === "count" && "Count"}
            </button>
          ));
        })()}
      </div>

      <label className="text-sm text-gray-600">
        Target {metric === "distance" ? "(km)" : metric === "duration" ? "(min)" : "(count)"}
      </label>
      <input
        type="number"
        className="w-full border rounded p-2 mb-3"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />

      <label className="text-sm text-gray-600">Name</label>
      <input
        type="text"
        className="w-full border rounded p-2 mb-5"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-full bg-amber-300 border border-amber-400 text-primary-text font-medium"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      <button
        onClick={del}
        className="w-full py-3 mt-3 rounded-full border border-red-400 text-red-600 font-medium"
      >
        Delete Goal
      </button>
    </ModalSheet>
  );
}
