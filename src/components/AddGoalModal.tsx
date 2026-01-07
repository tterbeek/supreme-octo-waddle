// src/components/AddGoalModal.tsx
import { useState } from "react";
import { supabase } from "../supabaseClient";
import ModalSheet from "./ModalSheet";
import type { Goal } from "../types";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles, milesToKm } from "../lib/units";

interface AddGoalModalProps {
  onClose: () => void;
  onAdded: () => void; 
  existingGoals: Goal[];
  onDuplicate: (goal: Goal) => void;
}

export default function AddGoalModal({ onClose, onAdded, onDuplicate, existingGoals }: AddGoalModalProps) {
  const getDefaultMetric = (typeId: string): Goal["metric"] | "duration" => {
    const cfg = ACTIVITY_TYPES[typeId];
    if (cfg?.defaultFields.includes("distance_km")) return "distance";
    if (cfg?.defaultFields.includes("duration_min")) return "duration";
    return "count";
  };

  const [activityType, setActivityType] = useState<string>("run");
  const [metric, setMetric] = useState<Goal["metric"] | "duration">(
    getDefaultMetric("run")
  );
  const [period, setPeriod] = useState<Goal["period"]>("week");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { unitSystem } = useUnitSystem();

  const autoName = () => {
    const typeLabel = ACTIVITY_TYPES[activityType]?.label || "Activity";
    const per = period === "week" ? "Weekly" : period === "month" ? "Monthly" : "Yearly";
    const what =
      metric === "distance" ? "Distance" : metric === "duration" ? "Duration" : "Count";
    return `${per} ${typeLabel} ${what}`;
  };

  const targetDisplay =
    metric === "distance"
      ? target
        ? String(
            Math.round(
              (unitSystem === "imperial"
                ? kmToMiles(Number(target))
                : Number(target)) * 10
            ) / 10
          )
        : ""
      : target;

  const handleTargetChange = (value: string) => {
    if (metric !== "distance") {
      setTarget(value);
      return;
    }
    if (value === "") {
      setTarget("");
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      setTarget("");
      return;
    }
    const kmValue = unitSystem === "imperial" ? milesToKm(numeric) : numeric;
    setTarget(String(kmValue));
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
    effective_from: new Date().toISOString(),
  });

  setSaving(false);
  onAdded();
  onClose();
};


  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4 text-center">Set direction</h2>

      {/* Activity type selector */}
      <div className="flex gap-3 overflow-x-auto pb-3 mb-3">
        {Object.values(ACTIVITY_TYPES).map((t) => {
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActivityType(t.id);
                let metricsForNewType: Array<Goal["metric"] | "duration"> = [];
                const cfg = ACTIVITY_TYPES[t.id];
                if (t.id === "any") {
                  metricsForNewType = ["count"];
                } else {
                  if (cfg?.defaultFields.includes("distance_km")) metricsForNewType.push("distance");
                  if (cfg?.defaultFields.includes("duration_min"))
                    metricsForNewType.push("duration" as Goal["metric"]);
                  metricsForNewType.push("count");
                }
                if (!metricsForNewType.includes(metric)) {
                  setMetric(metricsForNewType[0]);
                }
              }}
              className={`flex flex-col items-center p-2 rounded-xl border ${
                activityType === t.id
                  ? "border-amber-400 bg-amber-100"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Icon size={22} />
              <span className="text-xs mt-1">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Metric selector */}
      <label className="block text-sm mb-1">Metric</label>
      <div className="flex gap-2 mb-3">
        {(() => {
          const typeConfig = ACTIVITY_TYPES[activityType];
          let metricsForType: Array<Goal["metric"] | "duration"> = [];
          if (activityType === "any") {
            metricsForType = ["count"];
          } else {
            if (typeConfig?.defaultFields.includes("distance_km")) metricsForType.push("distance");
            if (typeConfig?.defaultFields.includes("duration_min"))
              metricsForType.push("duration" as Goal["metric"]);
            metricsForType.push("count");
          }
          return metricsForType.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-3 py-2 rounded-md border ${
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
        Target{" "}
        {metric === "distance"
          ? `(${unitSystem === "imperial" ? "mi" : "km"})`
          : metric === "duration"
          ? "(min)"
          : "(count)"}
      </label>
      <input
        className="w-full border rounded p-2 mb-3"
        value={metric === "distance" ? targetDisplay : target}
        onChange={(e) => handleTargetChange(e.target.value)}
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
        {saving ? "Saving…" : "Set direction"}
      </button>
    </ModalSheet>
  );
}
