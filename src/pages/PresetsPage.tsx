import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import type { Preset } from "../types";
import { Zap } from "lucide-react";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import TooltipBubble from "../components/TooltipBubble";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useUnitSystem } from "../contexts/UnitContext";
import { formatDurationMinutes, kmToMiles } from "../lib/units";
import EditPresetModal from "../features/presets/EditPresetModal";
import AddPresetModal from "../features/presets/AddPresetModal";
import { fetchPresets, fetchPreset } from "../services/preset.service";



export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
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

      const data = await fetchPresets(user.id);
      setPresets(data);
    };

    load();
  }, []);

  useEffect(() => {
    if (!hasDoneOnboarding) return;
    if (!hasSeen("presets_info")) {
      showTooltip("presets_info");
    }
  }, [hasDoneOnboarding, hasSeen, showTooltip]);

  const filteredPresets = presets.filter((p) => p.type === selectedType);
  const selectedTypeLabel =
    ACTIVITY_TYPES[selectedType]?.label || selectedType;
  const equipmentSummaryForPreset = (preset: Preset) => {
    if (!preset.equipment || preset.equipment.length === 0) return "";
    const firstName = preset.equipment[0]?.name;
    if (!firstName) return "";
    const maxLen = 26;
    let label = firstName.length > maxLen ? `${firstName.slice(0, maxLen - 3)}...` : firstName;
    if (preset.equipment.length > 1) {
      label = `${label}...`;
    }
    return label;
  };

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
    onClick={() => {
      setEditingPreset(null);
      setShowForm(true);
    }}
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
            const distanceUnit = unitSystem === "imperial" ? "mi" : "km";
            const distanceDisplay =
              p.distance_km != null
                ? unitSystem === "imperial"
                  ? `${Math.round(kmToMiles(Number(p.distance_km)) * 100) / 100} ${distanceUnit}`
                  : `${p.distance_km} ${distanceUnit}`
                : null;
            const equipmentSummary = equipmentSummaryForPreset(p);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setEditingPreset(p);
                  setShowForm(true);
                }}
                className="border rounded-lg p-4 mb-3 bg-white shadow-sm text-left w-full"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 uppercase">
                      {typeConfig.label}
                    </span>
                  </div>
                </div>
                <div className="text-base font-semibold text-gray-800">
                  {p.name || "Untitled preset"}
                </div>
                <div className="text-sm text-gray-600 mt-1 flex gap-2 flex-wrap items-center">
                  {distanceDisplay && <span>{distanceDisplay}</span>}
                  {p.duration_min != null && (
                    <span>
                      {distanceDisplay ? "·" : null}{" "}
                      {formatDurationMinutes(Number(p.duration_min))}
                    </span>
                  )}
                </div>
                {equipmentSummary && (
                  <div className="text-sm text-gray-500 mt-1">{equipmentSummary}</div>
                )}
                {isEndurance && p.effort != null && (
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: Number(p.effort) || 0 }).map((_, idx) => (
                      <Zap key={idx} className="w-4 h-4 text-movenotes-accent" />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showForm && editingPreset && (
        <EditPresetModal
          preset={editingPreset as Preset}
          onClose={() => setShowForm(false)}
          onSaved={async (newPreset) => {
            setShowForm(false);
            if (newPreset) {
              const updated = await fetchPreset(newPreset.id);
              if (updated) {
                setPresets((prev) => {
                  const next = [...prev.filter((p) => p.id !== updated.id), updated];
                  return next.sort((a, b) => {
                    if (a.type === b.type) {
                      return (a.name || "").localeCompare(b.name || "");
                    }
                    return (a.type || "").localeCompare(b.type || "");
                  });
                });
              }
            } else {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) return;
              const data = await fetchPresets(user.id);
              setPresets(data);
            }
          }}
          onDeleted={(id) => {
            setPresets((prev) => prev.filter((p) => p.id !== id));
          }}
        />
      )}

      {showForm && !editingPreset && (
        <AddPresetModal
          initialType={selectedType}
          onClose={() => setShowForm(false)}
          onSaved={async (newPreset) => {
            setShowForm(false);
            if (newPreset) {
              const updated = await fetchPreset(newPreset.id);
              if (updated) {
                setPresets((prev) => {
                  const next = [...prev, updated];
                  return next.sort((a, b) => {
                    if (a.type === b.type) {
                      return (a.name || "").localeCompare(b.name || "");
                    }
                    return (a.type || "").localeCompare(b.type || "");
                  });
                });
              }
            }
          }}
        />
      )}

    </div>
  );
}
