import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalSheet from "./ModalSheet";
import TooltipBubble from "./TooltipBubble";
import FeelingSelector from "./quick-log/FeelingSelector";
import EffortSelector from "./quick-log/EffortSelector";
import { useTooltipManager, type TooltipKey } from "../hooks/useTooltipManager";
import { useUnitSystem } from "../contexts/UnitContext";
import { formatDistance } from "../lib/units";
import { useQuickLogForm } from "../hooks/useQuickLogForm";

type QuickLogFormProps = {
  initialType?: string;
  onClose: () => void;
  onLogged: (activityId: string) => void; // ✅ returns activity id
};

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
  const { unitSystem } = useUnitSystem();
  const ding = new Audio("/sounds/ding.mp3");
  const [showMorePresets, setShowMorePresets] = useState(false);

  const {
    activePreset,
    duration,
    feeling,
    date,
    title,
    effort,
    saveAsPreset,
    presetName,
    presetNameTouched,
    showOptionalDistance,
    showOptionalDuration,
    showMetricTooltip,
    metricTooltip,
    tooltipSeenKey,
    activityType,
    defaultFields,
    optionalFields,
    filteredPresets,
    displayDistance,
    handleDistanceChange,
    setTitle,
    setDate,
    setDuration,
    setFeeling,
    setEffort,
    setSaveAsPreset,
    setPresetName,
    setPresetNameTouched,
    setShowOptionalDistance,
    setShowOptionalDuration,
    setShowMetricTooltip,
    setMetricTooltipAcknowledged,
    usePreset,
    useCustom,
    save,
  } = useQuickLogForm({
    initialType,
    unitSystem,
    onClose,
    onLogged,
    onboardingDone,
    showTooltip,
    navigate,
    ding,
  });

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
