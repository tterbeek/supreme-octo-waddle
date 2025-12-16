import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { Zap } from "lucide-react";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import type { Preset } from "../types";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles, milesToKm } from "../lib/units";

type PresetFormProps = {
  initialType?: keyof typeof ACTIVITY_TYPES;
  preset?: Preset | null;
  onClose: () => void;
  onAdded: (newPreset?: Preset) => void;
};

export default function PresetForm({
  initialType = "run",
  preset = null,
  onClose,
  onAdded,
}: PresetFormProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const activityType =
    (preset?.type as keyof typeof ACTIVITY_TYPES) ?? initialType ?? "run";
  const typeConfig =
    ACTIVITY_TYPES[activityType] ?? ACTIVITY_TYPES["other"];

  const [name, setName] = useState(preset?.name ?? "");
  const [distanceKm, setDistanceKm] = useState<number | null>(
    preset?.distance_km ?? null
  );
  const [duration, setDuration] = useState(
    preset?.duration_min != null ? String(preset.duration_min) : ""
  );
  const [effort, setEffort] = useState(preset?.effort ?? 3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showOptionalDistance = typeConfig.optionalFields.includes("distance_km");
  const showOptionalDuration = typeConfig.optionalFields.includes("duration_min");

  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const { unitSystem } = useUnitSystem();

  const distanceDisplay =
    distanceKm == null
      ? ""
      : unitSystem === "imperial"
      ? String(Math.round(kmToMiles(distanceKm) * 100) / 100)
      : String(distanceKm);

  const handleDistanceChange = (value: string) => {
    if (value === "") {
      setDistanceKm(null);
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    const kmValue = unitSystem === "imperial" ? milesToKm(numeric) : numeric;
    setDistanceKm(kmValue);
  };

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in");
      return;
    }

    const distanceValue =
      (typeConfig.defaultFields.includes("distance_km") || showOptionalDistance) &&
      distanceKm != null
        ? distanceKm
        : null;

    const durationValue =
      (typeConfig.defaultFields.includes("duration_min") || showOptionalDuration) &&
      duration
        ? Number(duration)
        : null;

    const effortValue = ["run", "ride", "swim", "hike"].includes(activityType)
      ? effort
      : null;

    const payload = {
      name,
      distance_km: distanceValue,
      duration_min: durationValue,
      effort: effortValue,
    };

    let err;
    let newPreset: Preset | undefined;
    if (preset?.id) {
      const { data, error: updateErr } = await supabase
        .from("presets")
        .update(payload)
        .eq("id", preset.id)
        .select()
        .single();
      err = updateErr;
      newPreset = data as Preset | undefined;
    } else {
      const { data, error: insertErr } = await supabase
        .from("presets")
        .insert({
          user_id: user.id,
          type: activityType,
          ...payload,
        })
        .select()
        .single();
      err = insertErr;
      newPreset = data as Preset | undefined;
    }

    if (err) {
      console.error("[PresetForm] Save error:", err.message);
      setError(err.message || "Could not save preset");
      setSaving(false);
      return;
    }

    setSaving(false);
    onAdded(newPreset);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          startY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (startY.current == null) return;
          const diff = e.touches[0].clientY - startY.current;
          if (diff > 0) setDragY(diff);
        }}
        onTouchEnd={() => {
          if (dragY > 80) {
            setAnimateIn(false);
            setTimeout(onClose, 200);
          }
          setDragY(0);
          startY.current = null;
        }}
        style={{ transform: `translateY(${dragY}px)` }}
        className={`w-full max-w-md bg-white rounded-t-2xl p-6 transition-transform ${
          animateIn ? "translate-y-0" : "translate-y-full"
        } animate-fadeIn`}
      >
        <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>

        <h2 className="text-lg font-semibold text-gray-800 mb-4 capitalize">
          {preset ? "Edit Preset" : `Add ${typeConfig.label} Preset`}
        </h2>

        {/* Name */}
        <label className="text-sm text-gray-600">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-warm-200 rounded-md p-2 mb-4"
          placeholder="Morning Tempo"
        />

        {/* DISTANCE */}
        {(typeConfig.defaultFields.includes("distance_km") || showOptionalDistance) && (
          <>
            <label className="text-sm text-gray-600">
              Distance ({unitSystem === "imperial" ? "mi" : "km"})
            </label>
            <input
              type="number"
              value={distanceDisplay}
              onChange={(e) => handleDistanceChange(e.target.value)}
              className="w-full border border-warm-200 rounded-md p-2 mb-4"
            />
          </>
        )}

        {/* DURATION */}
        {(typeConfig.defaultFields.includes("duration_min") || showOptionalDuration) && (
          <>
            <label className="text-sm text-gray-600">Duration (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full border border-warm-200 rounded-md p-2 mb-4"
            />
          </>
        )}

        {/* Effort (endurance only) */}
        {["run", "ride", "swim", "hike"].includes(activityType) && (
          <>
            <label className="text-sm text-gray-600">Effort</label>
            <div className="flex justify-between max-w-xs mx-auto mb-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setEffort(n)}
                  className={`transition transform active:scale-95 ${
                    effort === n ? "scale-110" : ""
                  }`}
                >
                  <Zap
                    className={`w-6 h-6 ${
                      n <= effort ? "text-movenotes-accent" : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
        >
          {saving ? "Saving..." : preset ? "Save Changes" : "Save Preset"}
        </button>
      </div>
    </div>
  );
}
