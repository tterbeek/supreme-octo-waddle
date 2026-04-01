// src/components/AddGoalModal.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import ModalSheet from "./ModalSheet";
import type { Goal } from "../types";
import {
  ACTIVITY_TYPES,
  isCreatableActivityType,
  supportsActivityField,
} from "../config/activityTypes";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles, milesToKm } from "../lib/units";
import {
  getCachedUserActivityTypes,
  normalizeUserActivityTypes,
  subscribeUserActivityTypes,
  type UserActivityTypeRow,
} from "../lib/userActivityTypesCache";

interface AddGoalModalProps {
  onClose: () => void;
  onAdded: () => void; 
  existingGoals: Goal[];
  onDuplicate: (goal: Goal) => void;
}

export default function AddGoalModal({ onClose, onAdded, onDuplicate, existingGoals }: AddGoalModalProps) {
  const getDefaultMetric = (typeId: string): Goal["metric"] | "duration" => {
    if (supportsActivityField(typeId, "distance_km")) return "distance";
    if (supportsActivityField(typeId, "duration_min")) return "duration";
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
  const [userId, setUserId] = useState<string | null>(null);
  const [userActivityTypes, setUserActivityTypes] = useState<UserActivityTypeRow[]>(
    []
  );
  const { unitSystem } = useUnitSystem();
  const [hasUserPickedType, setHasUserPickedType] = useState(false);

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

  const getMetricsForType = (typeId: string) => {
    if (typeId === "any") return ["count"] as Array<Goal["metric"]>;
    const metrics: Array<Goal["metric"] | "duration"> = [];
    if (supportsActivityField(typeId, "distance_km")) metrics.push("distance");
    if (supportsActivityField(typeId, "duration_min")) {
      metrics.push("duration" as Goal["metric"]);
    }
    metrics.push("count");
    return metrics;
  };

  useEffect(() => {
    let cancelled = false;
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(user?.id ?? null);
    };
    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const cached = getCachedUserActivityTypes(userId);
    if (cached?.length) {
      setUserActivityTypes(normalizeUserActivityTypes(cached));
    }
    const unsubscribe = subscribeUserActivityTypes(userId, setUserActivityTypes);
    return () => {
      unsubscribe();
    };
  }, [userId]);

  const orderedActivityTypes = useMemo(() => {
    const anyType = ACTIVITY_TYPES["any"];
    if (!userActivityTypes.length) {
      const defaults = Object.values(ACTIVITY_TYPES).filter(
        (t) => t.id !== "any" && isCreatableActivityType(t.id)
      );
      return anyType ? [anyType, ...defaults] : defaults;
    }
    const enabled = userActivityTypes
      .filter(
        (row) => row.is_enabled && isCreatableActivityType(row.activity_type)
      )
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ACTIVITY_TYPES[row.activity_type])
      .filter(Boolean);
    return anyType ? [anyType, ...enabled] : enabled;
  }, [userActivityTypes]);

  useEffect(() => {
    if (hasUserPickedType) return;
    if (!orderedActivityTypes.length) return;
    const preferred =
      orderedActivityTypes.length > 1
        ? orderedActivityTypes[1]
        : orderedActivityTypes[0];
    if (!preferred || preferred.id === activityType) return;
    setActivityType(preferred.id);
    const metricsForNewType = getMetricsForType(preferred.id);
    if (!metricsForNewType.includes(metric)) {
      setMetric(metricsForNewType[0]);
    }
  }, [orderedActivityTypes, hasUserPickedType, activityType, metric]);

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
        {orderedActivityTypes.map((t) => {
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setHasUserPickedType(true);
                setActivityType(t.id);
                const metricsForNewType = getMetricsForType(t.id);
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
            if (supportsActivityField(activityType, "distance_km")) {
              metricsForType.push("distance");
            }
            if (supportsActivityField(activityType, "duration_min")) {
              metricsForType.push("duration" as Goal["metric"]);
            }
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
