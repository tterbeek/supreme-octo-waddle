// src/components/EditGoalModal.tsx
import { useState } from "react";
import ModalSheet from "./ModalSheet";
import { supabase } from "../supabaseClient";
import type { Goal } from "../types";
import { Bike, Footprints, Target, CalendarDays, Ruler, Hash } from "lucide-react";

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
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);

    await supabase
      .from("goals")
      .update({
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
    {goal.activity_type === "run" && <Footprints className="w-5 h-5" />}
    {goal.activity_type === "ride" && <Bike className="w-5 h-5" />}
    {goal.activity_type === "any" && <Target className="w-5 h-5" />}

    <span className="font-medium">
      Activity: {goal.activity_type}
    </span>
  </div>

  {/* Period — ALWAYS CalendarDays */}
  <div className="flex items-center gap-2">
    <CalendarDays className="w-5 h-5" />
    <span className="font-medium capitalize">
      Period: {goal.period}
    </span>
  </div>

  {/* Metric (distance / count) */}
  <div className="flex items-center gap-2">
    {goal.metric === "distance" && <Ruler className="w-5 h-5" />}
    {goal.metric === "count" && <Hash className="w-5 h-5" />}

    <span className="font-medium">
      Metric: {goal.metric}
    </span>
  </div>
</div>


      <label className="text-sm text-gray-600">Target</label>
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
