import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalSheet from "../../components/ModalSheet";
import PresetsBar from "../../components/quick-log/PresetsBar";
import SavePresetFooter from "../../components/quick-log/SavePresetFooter";
import { useTooltipManager } from "../../hooks/useTooltipManager";
import { useUnitSystem } from "../../contexts/UnitContext";
import { formatDistance } from "../../lib/units";
import { useQuickLogForm } from "../../hooks/useQuickLogForm";
import EquipmentDialog from "../../components/EquipmentDialog";
import ActivityFormFields from "../../components/ActivityFormFields";

type QuickLogFormProps = {
  initialType?: string;
  initialDate?: string;
  returnTo?: string;
  onClose: () => void;
  onLogged: (activityId: string) => void; // ✅ returns activity id
};

export default function AddActivityForm({
  initialType = "run",
  initialDate,
  returnTo,
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
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);

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
    equipment,
    selectedEquipmentIds,
    setSelectedEquipmentIds,
    displayDistance,
    handleDistanceChange,
    addEquipment,
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
    initialDate,
    returnTo,
    unitSystem,
    onClose,
    onLogged,
    onboardingDone,
    showTooltip,
    navigate,
    ding,
  });

  const equipmentSummary = (() => {
    if (selectedEquipmentIds.length === 0) return "";
    const first = equipment.find((item) => item.id === selectedEquipmentIds[0]);
    if (!first) return "";
    const maxLen = 26;
    let label = first.name;
    if (label.length > maxLen) {
      label = `${label.slice(0, maxLen - 3)}...`;
    }
    if (selectedEquipmentIds.length > 1) {
      label = `${label}...`;
    }
    return label;
  })();

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

        <ActivityFormFields
          values={{
            title,
            date,
            distanceDisplay: displayDistance,
            duration,
            feeling,
            effort,
            activityType,
            defaultFields,
            optionalFields,
            showOptionalDistance,
            showOptionalDuration,
          }}
          unitSystem={unitSystem}
          onTitleChange={setTitle}
          onDateChange={setDate}
          onDistanceChange={handleDistanceChange}
          onDurationChange={setDuration}
          onShowDistance={() => setShowOptionalDistance(true)}
          onShowDuration={() => setShowOptionalDuration(true)}
          onFeelingChange={setFeeling}
          onEffortChange={setEffort}
          equipmentSummary={equipmentSummary}
          onEquipmentClick={() => setShowEquipmentDialog(true)}
        />

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

      {showEquipmentDialog && (
        <EquipmentDialog
          equipment={equipment}
          selectedEquipmentIds={selectedEquipmentIds}
          onChange={(ids) => setSelectedEquipmentIds(ids)}
          onAddEquipment={addEquipment}
          onClose={() => setShowEquipmentDialog(false)}
        />
      )}

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
