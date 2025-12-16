import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import type { Preset } from "../types";
import PresetForm from "../components/PresetForm";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import TooltipBubble from "../components/TooltipBubble";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles, milesToKm } from "../lib/units";



export default function PresetsPage() {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [edit, setEdit] = useState<
    Record<
      string,
      { name: string; distance: string; duration: string; effort: number | null }
    >
  >({});

  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<
    keyof typeof ACTIVITY_TYPES
  >("run");
  const { visible, showTooltip, hideTooltip, hasSeen } = useTooltipManager();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const { unitSystem } = useUnitSystem();
  const hasDoneOnboarding =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";


  // Load presets
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("presets")
        .select("*")
        .eq("user_id", user.id)
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      setPresets(data || []);

      // Initialize editable copy
      const obj: Record<
        string,
        { name: string; distance: string; duration: string; effort: number | null }
      > = {};
      (data || []).forEach((p) => {
        obj[p.id] = {
          name: p.name ?? "",
          distance: String(p.distance_km ?? ""),
          duration: String(p.duration_min ?? ""),
          effort: p.effort ?? 3,
        };
      });
      setEdit(obj);
    };

    load();
  }, []);

  useEffect(() => {
    if (!hasDoneOnboarding) return;
    if (!hasSeen("presets_info")) {
      showTooltip("presets_info");
    }
  }, [hasDoneOnboarding, hasSeen, showTooltip]);

  const toDisplayDistance = (distanceKm: string) => {
    if (distanceKm === "") return "";
    const numeric = Number(distanceKm);
    if (Number.isNaN(numeric)) return "";
    const display = unitSystem === "imperial" ? kmToMiles(numeric) : numeric;
    return String(Math.round(display * 100) / 100);
  };

  const parseDistanceInput = (value: string) => {
    if (value === "") return "";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "";
    const kmValue = unitSystem === "imperial" ? milesToKm(numeric) : numeric;
    return String(kmValue);
  };

  // Update local edit state
  const setField = (
    id: string,
    field: "name" | "distance" | "duration" | "effort",
    value: any
  ) => {
    setEdit((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: field === "distance" ? parseDistanceInput(value) : value,
      },
    }));
  };

  // Save changes
  const save = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const updates = Object.entries(edit).map(([id, e]) => {
      const typeConfig = ACTIVITY_TYPES[
        (presets.find((p) => p.id === id)?.type as keyof typeof ACTIVITY_TYPES) ||
          "other"
      ];
      const allowEffort = ["run", "ride", "swim", "hike"].includes(typeConfig.id);
      return {
        id,
        user_id: user.id,
        name: e.name,
        distance_km: e.distance === "" ? null : Number(e.distance),
        duration_min: e.duration === "" ? null : Number(e.duration),
        effort: allowEffort ? e.effort ?? 3 : null,
      };
    });

    await supabase.from("presets").upsert(updates, { onConflict: "id" });
    navigate("/");
  };

  // Delete preset
  const del = async (id: string) => {
    await supabase.from("presets").delete().eq("id", id);
    setPresets((prev) => prev.filter((p) => String(p.id) !== id));
  };

  const filteredPresets = presets.filter((p) => p.type === selectedType);
  const selectedTypeLabel =
    ACTIVITY_TYPES[selectedType]?.label || selectedType;

  // ✅ Proper return block
  return (
<div className="mb-4">
  <div className="relative flex items-center justify-center" ref={headerRef}>
    <h1 className="text-lg font-bold text-gray-600 text-center">
      Presets
    </h1>
    {visible === "presets_info" && (
      <TooltipBubble position="bottom" onClose={hideTooltip}>
        Create a preset to make logging your regular activities one tap faster.
      </TooltipBubble>
    )}
  </div>

{/* Activity type selector */}
<div className="flex gap-3 my-4 overflow-x-auto pb-2">
  {Object.values(ACTIVITY_TYPES)
    .filter((t) => t.id !== "any")
    .map((t) => {
    const Icon = t.Icon;
    return (
      <button
        key={t.id}
        onClick={() => setSelectedType(t.id as keyof typeof ACTIVITY_TYPES)}
        className={`flex flex-col items-center px-3 py-2 rounded-xl border ${
          selectedType === t.id
            ? "bg-amber-100 border-amber-300"
            : "bg-warm-100 border-warm-200"
        }`}
      >
        <Icon size={22} />
        <span className="text-xs mt-1">{t.label}</span>
      </button>
    );
  })}
</div>

{/* Add Preset Button */}
<h2 className="text-sm font-medium text-gray-500 mb-2">Add Preset</h2>
<div className="flex gap-4 mb-6">
  <button
    onClick={() => setShowForm(true)}
    className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
  >
    <span className="text-xl">+</span>
    <span>Add Preset</span>
  </button>
</div>

      {filteredPresets.length === 0 && (
        <p className="text-gray-500 text-sm mb-4">No presets for this activity type</p>
      )}

      {filteredPresets.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 capitalize">
            <span>{selectedTypeLabel}</span>
          </h2>

          {filteredPresets.map((p) => {
            const typeConfig = ACTIVITY_TYPES[p.type] ?? ACTIVITY_TYPES["other"];
            const isEndurance = ["run", "ride", "swim", "hike"].includes(
              typeConfig.id
            );
            const distanceValue = edit[p.id]?.distance ?? "";
            const displayDistance = toDisplayDistance(distanceValue);
            return (
            <div
              key={p.id}
              className="border rounded-lg p-4 mb-3 bg-white shadow-sm"
            >
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-gray-600">Name</label>
                <button
                  onClick={() => del(String(p.id))}
                  className="text-xs text-red-500 underline"
                >
                  Delete
                </button>
              </div>

              <input
                type="text"
                value={edit[p.id]?.name ?? ""}
                onChange={(e) => setField(String(p.id), "name", e.target.value)}
                className="w-full border rounded-md p-2 mb-3 text-sm"
              />

              {/* Distance (if default/optional) */}
              {typeConfig.defaultFields.includes("distance_km") ||
              typeConfig.optionalFields.includes("distance_km") ? (
                <>
                  <label className="block text-xs text-gray-600 mb-1">
                    Distance ({unitSystem === "imperial" ? "mi" : "km"})
                  </label>
                  <input
                    type="number"
                    value={displayDistance}
                    onChange={(e) =>
                      setField(String(p.id), "distance", e.target.value)
                    }
                    className="w-full border rounded-md p-2 mb-3 text-sm"
                  />
                </>
              ) : null}

              {/* Duration (if default/optional) */}
              {typeConfig.defaultFields.includes("duration_min") ||
              typeConfig.optionalFields.includes("duration_min") ? (
                <>
                  <label className="block text-xs text-gray-600 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={edit[p.id]?.duration ?? ""}
                    onChange={(e) =>
                      setField(String(p.id), "duration", e.target.value)
                    }
                    className="w-full border rounded-md p-2 mb-3 text-sm"
                  />
                </>
              ) : null}

              {/* Effort (endurance only) */}
              {isEndurance && (
                <>
                  <label className="block text-xs text-gray-600 mb-1">
                    Effort
                  </label>
                  <div className="flex justify-between max-w-xs mb-3">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setField(String(p.id), "effort", val)}
                        className={`transition transform active:scale-95 ${
                          edit[p.id]?.effort === val ? "scale-110" : ""
                        }`}
                      >
                        <Zap
                          className={`w-5 h-5 ${
                            val <= (edit[p.id]?.effort ?? 0)
                              ? "text-movenotes-accent"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* --- ACTION BUTTONS --- */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => navigate("/")}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-full text-sm font-medium"
        >
          Cancel
        </button>

        <button
          onClick={save}
          className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-2 rounded-full text-sm font-medium transition transform hover:-translate-y-0.5"
        >
          Save
        </button>
      </div>
      {showForm && (
        <PresetForm
          initialType={selectedType}
          onClose={() => setShowForm(false)}
          onAdded={async (newPreset) => {
            setShowForm(false);
            if (newPreset) {
              setPresets((prev) => {
                const next = [...prev.filter((p) => p.id !== newPreset.id), newPreset];
                // simple sort: type then name
                return next.sort((a, b) => {
                  if (a.type === b.type) {
                    return (a.name || "").localeCompare(b.name || "");
                  }
                  return (a.type || "").localeCompare(b.type || "");
                });
              });
              setEdit((prev) => ({
                ...prev,
                [newPreset.id]: {
                  name: newPreset.name ?? "",
                  distance: String(newPreset.distance_km ?? ""),
                  duration: String(newPreset.duration_min ?? ""),
                  effort: newPreset.effort ?? 3,
                },
              }));
            } else {
              // fallback reload if no preset returned
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) return;
              const { data } = await supabase
                .from("presets")
                .select("*")
                .eq("user_id", user.id)
                .order("type", { ascending: true })
                .order("name", { ascending: true });
              setPresets(data || []);
            }
          }}
        />
      )}

    </div>
  );
}
