import { useEffect, useState } from "react";
import type { Preset } from "../types";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Zap, Frown, Meh, Smile, Laugh } from "lucide-react";
import ModalSheet from "./ModalSheet";
import TooltipBubble from "./TooltipBubble";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { useTooltipManager } from "../hooks/useTooltipManager";
import {
  resolveActivityFields,
  type ActivityPreference,
} from "../lib/resolveActivityFields";
import { useUnitSystem } from "../contexts/UnitContext";
import { formatDistance, kmToMiles, milesToKm } from "../lib/units";
import type { ReactNode } from "react";

type QuickLogFormProps = {
  initialType?: string;
  onClose: () => void;
  onLogged: (activityId: string) => void; // ✅ returns activity id
};

type FeelingSelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

function FeelingSelector({ value, onChange }: FeelingSelectorProps) {
  return (
    <div className="w-full">
      <label className="block text-sm text-gray-600 mb-2 text-center">
        Feeling
      </label>
      <div className="flex justify-between w-full max-w-sm mx-auto">
        {[
          { Icon: Frown, value: 1 },
          { Icon: Meh, value: 2 },
          { Icon: Smile, value: 3 },
          { Icon: Laugh, value: 4 },
        ].map(({ Icon, value: val }) => {
          const active = value === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className={`transition transform active:scale-95 ${
                active ? "scale-110" : "opacity-70"
              }`}
            >
              <Icon
                className={`w-7 h-7 ${
                  active ? "text-movenotes-accent" : "text-gray-300"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

type EffortSelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

function EffortSelector({ value, onChange }: EffortSelectorProps) {
  return (
    <div className="w-full">
      <label className="block text-sm text-gray-600 mb-2 text-center">
        Effort
      </label>
      <div className="flex justify-between w-full max-w-sm mx-auto">
        {[1, 2, 3, 4, 5].map((val) => {
          const active = val <= value;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className={`transition transform active:scale-95 ${
                value === val ? "scale-110" : ""
              }`}
            >
              <Zap
                className={`w-5 h-5 ${
                  active ? "text-movenotes-accent" : "text-gray-300"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

async function fetchActivityPreference(
  userId: string,
  activityType: string
) {
  const { data, error } = await supabase
    .from("activity_preferences")
    .select("activity_type, default_metric")
    .eq("user_id", userId)
    .eq("activity_type", activityType)
    .maybeSingle();

  if (error) {
    console.error(
      "[QuickLogForm] Error fetching activity preference:",
      error.message
    );
    return undefined;
  }

  return data ?? undefined;
}

export default function QuickLogForm2({
  initialType = "run",
  onClose,
  onLogged,
}: QuickLogFormProps) {
  const navigate = useNavigate();
  const { showTooltip } = useTooltipManager();
  const onboardingDone =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [duration, setDuration] = useState("");
  const [feeling, setFeeling] = useState(3);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState<number>(3);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetNameTouched, setPresetNameTouched] = useState(false);
  const [showOptionalDistance, setShowOptionalDistance] = useState(false);
  const [showOptionalDuration, setShowOptionalDuration] = useState(false);
  const [showMetricTooltip, setShowMetricTooltip] = useState(false);
  const [metricTooltip, setMetricTooltip] = useState<React.ReactNode>("");
  const [metricTooltipAcknowledged, setMetricTooltipAcknowledged] = useState(false);
  const [tooltipAlreadySeen] = useState(() => {
    if (typeof window === "undefined") return false;
    const key = `metric_tooltip_seen_${initialType}`;
    return localStorage.getItem(key) === "true";
  });
  const tooltipSeenKey = `metric_tooltip_seen_${initialType}`;

  const [activityType] = useState(initialType);
  const typeConfig = ACTIVITY_TYPES[activityType];
  const [preference, setPreference] = useState<ActivityPreference | undefined>();
  const { defaultFields, optionalFields } = resolveActivityFields(
    activityType,
    preference
  );
  const { unitSystem } = useUnitSystem();

  const ding = new Audio("/sounds/ding.mp3");

  const [showMorePresets, setShowMorePresets] = useState(false);

  const filteredPresets = presets.filter((p) => p.type === activityType);

  const displayDistance =
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
    setShowOptionalDistance(false);
    setShowOptionalDuration(false);
    setPreference(undefined);
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("presets")
        .select("*")
        .eq("user_id", user.id)
        .order("last_used_at", { ascending: false });

      setPresets(data || []);

      const initialPresets = (data || []).filter(
        (p) => p.type === activityType
      );

      if (initialPresets.length > 0) {
        const first = initialPresets[0];
        setActivePreset(first);
        setDistanceKm(first.distance_km ?? null);
        setDuration(first.duration_min != null ? String(first.duration_min) : "");
        setShowOptionalDistance(!!first.distance_km);
        setShowOptionalDuration(!!first.duration_min);
        setTitle(first.name ?? "");
        setEffort(first.effort ?? 3);
      }

      const preferenceData = await fetchActivityPreference(
        user.id,
        activityType
      );
      setPreference(preferenceData);
    };

    load();
  }, [activityType]);

  useEffect(() => {
    if (!presetNameTouched) {
      setPresetName(title);
    }
  }, [title, presetNameTouched]);

  const usePreset = (preset: Preset) => {
    setActivePreset(preset);
    setDistanceKm(preset.distance_km ?? null);
    setDuration(
      preset.duration_min != null ? String(preset.duration_min) : ""
    );
    setShowOptionalDistance(!!preset.distance_km);
    setShowOptionalDuration(!!preset.duration_min);
    setTitle(preset.name ?? ""); // ✅ new
    setEffort(preset.effort ?? 3);
  };

  const useCustom = () => {
    setActivePreset(null);
    setDistanceKm(null);
    setDuration("");
    setTitle(""); // ✅ clear title
    setPresetName("");
    setPresetNameTouched(false);
    setShowOptionalDistance(false);
    setShowOptionalDuration(false);
  };

  const save = async () => {
    // Guard: ensure default metric is present
    const needsDistance = defaultFields.includes("distance_km");
    const needsDuration = defaultFields.includes("duration_min");
    const defaultMetricLabel = needsDistance ? "distance" : "duration";
    const altMetricLabel = needsDistance ? "duration" : "distance";

    if (
      needsDistance &&
      distanceKm == null &&
      !metricTooltipAcknowledged &&
      !tooltipAlreadySeen
    ) {
      setMetricTooltip(
        <>
          <p className="text-sm text-gray-800">
            {typeConfig.label} tracks {defaultMetricLabel} by default. You’re logging only{" "}
            {altMetricLabel}. If you prefer using {altMetricLabel} for this activity,
            change the default metric in Settings → Activity Preferences.
          </p>
          <a
            href="/settings/activity-preferences"
            className="text-sm text-movenotes-primary underline block mt-2"
          >
            Go to Activity Preferences
          </a>
          <p className="text-xs text-gray-600 mt-2">
            Close to save anyway without {defaultMetricLabel}.
          </p>
        </>
      );
      setShowMetricTooltip(true);
      return;
    }

    if (needsDuration && !duration && !metricTooltipAcknowledged && !tooltipAlreadySeen) {
      setMetricTooltip(
        <>
          <p className="text-sm text-gray-800">
            {typeConfig.label} tracks {defaultMetricLabel} by default. You’re logging only{" "}
            {altMetricLabel}. If you prefer using {altMetricLabel} for this activity,
            change the default metric in Settings → Activity Preferences.
          </p>
          <a
            href="/settings/activity-preferences"
            className="text-sm text-movenotes-primary underline block mt-2"
          >
            Go to Activity Preferences
          </a>
          <p className="text-xs text-gray-600 mt-2">
            Close to save anyway without {defaultMetricLabel}.
          </p>
        </>
      );
      setShowMetricTooltip(true);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const distanceValue =
      (defaultFields.includes("distance_km") ||
        showOptionalDistance) && distanceKm != null
        ? distanceKm
        : null;

    const durationValue =
      (defaultFields.includes("duration_min") ||
        showOptionalDuration) && duration
        ? Number(duration)
        : null;

    const effortValue = ["run", "ride", "swim", "hike"].includes(activityType)
      ? Number(effort) || null
      : null;

    const feelingValue = Number(feeling) || null;

    const { data, error } = await supabase
      .from("activities")
      .insert([
        {
          user_id: user.id,
          type: activityType,
          date,
          distance_km: distanceValue,
          duration_min: durationValue,
          effort: effortValue,
          feeling: feelingValue,
          title,
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("[QuickLogForm] Error saving activity:", error.message);
      return;
    }

    const newActivityId = data?.id;
    if (!newActivityId) {
      console.warn("[QuickLogForm] No activity ID returned after insert");
      return;
    }

    if (saveAsPreset && presetName.trim()) {
      const { error: presetError } = await supabase.from("presets").insert([
        {
          user_id: user.id,
          type: activityType,
          name: presetName.trim(),
          distance_km: distanceValue,
          duration_min: durationValue,
          effort: effortValue,
        },
      ]);
      if (presetError) {
        console.error("[QuickLogForm] Error saving preset:", presetError.message);
      }
    }

    if (activePreset) {
      await supabase
        .from("presets")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", activePreset.id);
    }

    if (onboardingDone) {
      showTooltip("after_first_log");
    }
    ding.play();
    onLogged(newActivityId); // ✅ pass id to Home

    setTimeout(() => {
      onClose();
      navigate("/");
    }, 400);

    setTimeout(() => {
      onClose();
      navigate("/");
    }, 400);
  };

  return (
    <>
      {/* MAIN QUICKLOG SHEET */}
      <ModalSheet onClose={onClose} enableDragToClose>
        {/* Presets */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {filteredPresets.slice(0, 3).map((p) => (
            <button
              key={p.id}
              onClick={() => usePreset(p)}
              className={`px-3 py-1 rounded-full text-sm border transition whitespace-nowrap ${
                activePreset?.id === p.id
                ? "bg-amber-300 border-amber-400 text-primary-text"
                : "border-gray-300 text-gray-600"
              }`}
            >
              {p.name}
            </button>
          ))}

          <button
            onClick={useCustom}
            className={`px-3 py-1 rounded-full text-sm border transition whitespace-nowrap ${
              activePreset === null
                ? "bg-amber-50 border-amber-300 text-gray-800"
                : "border-gray-300 text-gray-600"
            }`}
          >
            Custom
          </button>

          {/* More… */}
          {filteredPresets.length > 3 && (
            <button
              onClick={() => setShowMorePresets(true)}
              className="px-3 py-1 rounded-full text-sm border border-gray-300 text-gray-600 whitespace-nowrap"
            >
              More…
            </button>
          )}
        </div>

        {/* Title */}
        <label className="text-sm text-gray-600">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
        />

        {/* Date */}
        <label className="text-sm text-gray-600">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
        />

        {/* DISTANCE FIELD */}
        {(defaultFields.includes("distance_km") ||
          showOptionalDistance) && (
          <div className="form-group mb-4">
            <label className="text-sm text-gray-600">
              Distance ({unitSystem === "imperial" ? "mi" : "km"})
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={displayDistance}
              onChange={(e) => handleDistanceChange(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>
        )}

        {/* OPTIONAL DISTANCE BUTTON */}
        {!defaultFields.includes("distance_km") &&
          optionalFields.includes("distance_km") &&
          !showOptionalDistance && (
            <button
              type="button"
              className="text-movenotes-primary text-sm underline mb-4"
              onClick={() => setShowOptionalDistance(true)}
            >
              + Add distance
            </button>
        )}

        {/* DURATION FIELD */}
        {(defaultFields.includes("duration_min") ||
          showOptionalDuration) && (
          <div className="form-group mb-4">
            <label className="text-sm text-gray-600">Duration (min)</label>
            <input
              type="number"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>
        )}

        {/* OPTIONAL DURATION BUTTON */}
        {!defaultFields.includes("duration_min") &&
          optionalFields.includes("duration_min") &&
          !showOptionalDuration && (
            <button
              type="button"
              className="text-movenotes-primary text-sm underline mb-4"
              onClick={() => setShowOptionalDuration(true)}
            >
              + Add duration
            </button>
          )}

        <div className="mb-4 flex flex-col items-center gap-4">
          <FeelingSelector value={feeling} onChange={setFeeling} />
          {["run", "ride", "swim", "hike"].includes(activityType) && (
            <EffortSelector value={effort} onChange={setEffort} />
          )}
        </div>

        <div className="mt-6 mb-5 space-y-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={saveAsPreset}
              className="accent-movenotes-primary"
              onChange={() => {
                const next = !saveAsPreset;
                setSaveAsPreset(next);
                if (next && !presetNameTouched && !presetName) {
                  setPresetName(title || "");
                }
              }}
            />
            <span className="text-sm text-gray-700">Save activity as preset</span>
          </label>

          {saveAsPreset && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Preset name
              </label>
              <input
                type="text"
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="e.g. Morning 5k loop"
                value={presetName}
                onChange={(e) => {
                  setPresetName(e.target.value);
                  setPresetNameTouched(true);
                }}
              />
            </div>
          )}
        </div>

        {/* Save */}
        <div className="relative">
          <button
            onClick={save}
            className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
          >
            Save
          </button>

          {showMetricTooltip && (
            <TooltipBubble
              position="top"
              onClose={() => {
                setShowMetricTooltip(false);
                setMetricTooltipAcknowledged(true);
                localStorage.setItem(tooltipSeenKey, "true");
              }}
            >
              {metricTooltip}
            </TooltipBubble>
          )}
        </div>
      </ModalSheet>

      {/* SECOND SHEET: ALL PRESETS */}
      {showMorePresets && (
        <ModalSheet onClose={() => setShowMorePresets(false)}>
          <h2 className="text-lg font-semibold mb-4 text-center">All Presets</h2>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pb-4">
            {/* Custom goes FIRST */}
            <button
              onClick={() => {
                useCustom();
                setShowMorePresets(false);
              }}
              className="p-3 border rounded-md text-left bg-amber-50"
            >
              <div className="font-medium text-gray-800">Custom</div>
              <div className="text-sm text-gray-500">
                Create your own manual entry
              </div>
            </button>

            {filteredPresets.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  usePreset(p);
                  setShowMorePresets(false);
                }}
                className="p-3 border rounded-md text-left"
              >
                <div className="font-medium text-gray-800">{p.name}</div>
                <div className="text-sm text-gray-500">
                  {p.distance_km != null && formatDistance(p.distance_km, unitSystem)}
                  {p.duration_min != null &&
                    `${p.distance_km != null ? " · " : ""}${p.duration_min} min`}
                  {p.effort != null && ` · Effort ${p.effort}`}
                </div>
              </button>
            ))}
          </div>
        </ModalSheet>
      )}
    </>
  );
}
