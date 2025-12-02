import { useEffect, useState } from "react";
import type { Preset } from "../types";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Zap, Frown, Meh, Smile, Laugh } from "lucide-react";
import ModalSheet from "./ModalSheet";
import { ACTIVITY_TYPES } from "../config/activityTypes";

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

export default function QuickLogForm2({
  initialType = "run",
  onClose,
  onLogged,
}: QuickLogFormProps) {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [feeling, setFeeling] = useState(3);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState<number>(3);
  const [showOptionalDistance, setShowOptionalDistance] = useState(false);
  const [showOptionalDuration, setShowOptionalDuration] = useState(false);

  const [activityType] = useState(initialType);
  const typeConfig = ACTIVITY_TYPES[activityType];

  const ding = new Audio("/sounds/ding.mp3");

  const [showMorePresets, setShowMorePresets] = useState(false);

  const filteredPresets = presets.filter((p) => p.type === activityType);

  useEffect(() => {
    setShowOptionalDistance(false);
    setShowOptionalDuration(false);
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
        setDistance(first.distance_km != null ? String(first.distance_km) : "");
        setDuration(first.duration_min != null ? String(first.duration_min) : "");
        setShowOptionalDistance(!!first.distance_km);
        setShowOptionalDuration(!!first.duration_min);
        setTitle(first.name ?? "");
        setEffort(first.effort ?? 3);
      }
    };

    load();
  }, [activityType]);

  const usePreset = (preset: Preset) => {
    setActivePreset(preset);
    setDistance(
      preset.distance_km != null ? String(preset.distance_km) : ""
    );
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
    setDistance("");
    setDuration("");
    setTitle(""); // ✅ clear title
    setShowOptionalDistance(false);
    setShowOptionalDuration(false);
  };

  const save = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const distanceValue =
      (typeConfig.defaultFields.includes("distance_km") ||
        showOptionalDistance) && distance
        ? Number(distance)
        : null;

    const durationValue =
      (typeConfig.defaultFields.includes("duration_min") ||
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

    if (activePreset) {
      await supabase
        .from("presets")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", activePreset.id);
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
        {(typeConfig.defaultFields.includes("distance_km") ||
          showOptionalDistance) && (
          <div className="form-group mb-4">
            <label className="text-sm text-gray-600">Distance (km)</label>
            <input
              type="number"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>
        )}

        {/* OPTIONAL DISTANCE BUTTON */}
        {!typeConfig.defaultFields.includes("distance_km") &&
          typeConfig.optionalFields.includes("distance_km") &&
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
        {(typeConfig.defaultFields.includes("duration_min") ||
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
        {!typeConfig.defaultFields.includes("duration_min") &&
          typeConfig.optionalFields.includes("duration_min") &&
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

        {/* Save */}
        <button
          onClick={save}
          className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
        >
          Save
        </button>
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
                  {p.distance_km != null && `${p.distance_km} km`}
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
