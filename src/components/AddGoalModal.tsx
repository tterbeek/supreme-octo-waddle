// src/components/AddGoalModal.tsx
import { useState } from "react";
import { supabase } from "../supabaseClient";
import ModalSheet from "./ModalSheet";
import type { Goal } from "../types";

interface AddGoalModalProps {
  onClose: () => void;
  onAdded: () => void; 
  existingGoals: Goal[];
  onDuplicate: (goal: Goal) => void;
}

export default function AddGoalModal({ onClose, onAdded, onDuplicate, existingGoals }: AddGoalModalProps) {
  const [activityType, setActivityType] = useState<Goal["activity_type"]>("run");
  const [metric, setMetric] = useState<Goal["metric"]>("distance");
  const [period, setPeriod] = useState<Goal["period"]>("week");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const autoName = () => {
    const act = activityType === "any" ? "Activity" : activityType === "run" ? "Run" : "Ride";
    const per = period === "week" ? "Weekly" : period === "month" ? "Monthly" : "Yearly";
    const what = metric === "distance" ? "Distance" : "Count";
    return `${per} ${act} ${what}`;
  };

const save = async () => {
  if (!target) return;

  // 🔍 Check for duplicate BEFORE saving
  const duplicate = existingGoals.find(
    (g) =>
      g.activity_type === activityType &&
      g.metric === metric &&
      g.period === period
  );

  if (duplicate) {
    // 🚫 Prevent saving — open edit modal instead
    onDuplicate(duplicate);
    onClose(); 
    return;
  }

  setSaving(true);

  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from("goals").insert({
    user_id: user!.id,
    activity_type: activityType,
    metric,
    period,
    target: Number(target),
    name: name.trim() || autoName(),
  });

  setSaving(false);
  onAdded();
  onClose();
};


  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4 text-center">Add Goal</h2>

      <label className="text-sm text-gray-600">Activity Type</label>
      <select
        className="w-full border rounded p-2 mb-3"
        value={activityType}
        onChange={(e) => setActivityType(e.target.value as Goal["activity_type"])}
      >
        <option value="run">Run</option>
        <option value="ride">Ride</option>
        <option value="any">Any</option>
      </select>

      <label className="text-sm text-gray-600">Metric</label>
      <select
        className="w-full border rounded p-2 mb-3"
        value={metric}
        onChange={(e) => setMetric(e.target.value as Goal["metric"])}
      >
        <option value="distance">Distance (km)</option>
        <option value="count">Activity Count</option>
      </select>

      <label className="text-sm text-gray-600">Period</label>
      <select
        className="w-full border rounded p-2 mb-3"
        value={period}
        onChange={(e) => setPeriod(e.target.value as Goal["period"])}
      >
        <option value="week">Week</option>
        <option value="month">Month</option>
        <option value="year">Year</option>
      </select>

      <label className="text-sm text-gray-600">
        {metric === "distance" ? "Target Distance" : "Target Count"}
      </label>
      <input
        className="w-full border rounded p-2 mb-3"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        type="number"
      />

      <label className="text-sm text-gray-600">
        Name (optional)
      </label>
      <input
        className="w-full border rounded p-2 mb-5"
        placeholder={autoName()}
        value={name}
        onChange={(e) => setName(e.target.value)}
        type="text"
      />

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-full bg-amber-300 border border-amber-400 text-primary-text font-medium"
      >
        {saving ? "Saving…" : "Add Goal"}
      </button>
    </ModalSheet>
  );
}
