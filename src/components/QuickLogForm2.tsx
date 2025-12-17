import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalSheet from "./ModalSheet";
import FeelingSelector from "./quick-log/FeelingSelector";
import EffortSelector from "./quick-log/EffortSelector";
import PresetsBar from "./quick-log/PresetsBar";
import DistanceDurationFields from "./quick-log/DistanceDurationFields";
import SavePresetFooter from "./quick-log/SavePresetFooter";
import { useTooltipManager } from "../hooks/useTooltipManager";
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
        <PresetsBar
          presets={filteredPresets}
          activePreset={activePreset}
          onSelectPreset={usePreset}
          onSelectCustom={useCustom}
          onOpenMore={() => setShowMorePresets(true)}
        />

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

        <DistanceDurationFields
          defaultFields={defaultFields}
          optionalFields={optionalFields}
          showOptionalDistance={showOptionalDistance}
          showOptionalDuration={showOptionalDuration}
          displayDistance={displayDistance}
          duration={duration}
          unitSystem={unitSystem}
          onDistanceChange={handleDistanceChange}
          onDurationChange={setDuration}
          onShowDistance={() => setShowOptionalDistance(true)}
          onShowDuration={() => setShowOptionalDuration(true)}
        />

        <div className="mb-4 flex flex-col items-center gap-4">
          <FeelingSelector value={feeling} onChange={setFeeling} />
          {["run", "ride", "swim", "hike"].includes(activityType) && (
            <EffortSelector value={effort} onChange={setEffort} />
          )}
        </div>

        <SavePresetFooter
          saveAsPreset={saveAsPreset}
          presetName={presetName}
          showMetricTooltip={showMetricTooltip}
          metricTooltip={metricTooltip}
          onToggleSaveAsPreset={() => {
            const next = !saveAsPreset;
            setSaveAsPreset(next);
            if (next && !presetNameTouched && !presetName) {
              setPresetName(title || "");
            }
          }}
          onPresetNameChange={setPresetName}
          onPresetNameTouched={() => setPresetNameTouched(true)}
          onSave={save}
          onCloseMetricTooltip={() => {
            setShowMetricTooltip(false);
            setMetricTooltipAcknowledged(true);
            localStorage.setItem(tooltipSeenKey, "true");
          }}
        />
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
