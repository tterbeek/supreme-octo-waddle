type DistanceDurationFieldsProps = {
  defaultFields: string[];
  optionalFields: string[];
  showOptionalDistance: boolean;
  showOptionalDuration: boolean;
  displayDistance: string;
  duration: string;
  unitSystem: string;
  onDistanceChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onShowDistance: () => void;
  onShowDuration: () => void;
  forceShowOptional?: boolean;
  suppressAddButtons?: boolean;
  dense?: boolean;
};

export default function DistanceDurationFields({
  defaultFields,
  optionalFields,
  showOptionalDistance,
  showOptionalDuration,
  displayDistance,
  duration,
  unitSystem,
  onDistanceChange,
  onDurationChange,
  onShowDistance,
  onShowDuration,
  forceShowOptional = false,
  suppressAddButtons = false,
  dense = false,
}: DistanceDurationFieldsProps) {
  const distanceVisible =
    defaultFields.includes("distance_km") || showOptionalDistance || forceShowOptional;
  const durationVisible =
    defaultFields.includes("duration_min") || showOptionalDuration || forceShowOptional;
  const spacing = dense ? "mb-3" : "mb-4";
  const inputPadding = dense ? "p-2.5" : "p-2";

  return (
    <>
      {distanceVisible && (
        <div className={`form-group ${spacing}`}>
          <label className="text-sm text-gray-600">
            Distance ({unitSystem === "imperial" ? "mi" : "km"})
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={displayDistance}
            onChange={(e) => onDistanceChange(e.target.value)}
            className={`w-full border rounded-md ${inputPadding}`}
          />
        </div>
      )}

      {!suppressAddButtons &&
        !defaultFields.includes("distance_km") &&
        optionalFields.includes("distance_km") &&
        !showOptionalDistance && (
          <button
            type="button"
            className="text-movenotes-primary text-sm underline mb-4"
            onClick={onShowDistance}
          >
            + Add distance
          </button>
        )}

      {durationVisible && (
        <div className={`form-group ${spacing}`}>
          <label className="text-sm text-gray-600">Duration (min)</label>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            value={duration}
            onChange={(e) => onDurationChange(e.target.value)}
            className={`w-full border rounded-md ${inputPadding}`}
          />
        </div>
      )}

      {!suppressAddButtons &&
        !defaultFields.includes("duration_min") &&
        optionalFields.includes("duration_min") &&
        !showOptionalDuration && (
          <button
            type="button"
            className="text-movenotes-primary text-sm underline mb-4"
            onClick={onShowDuration}
          >
            + Add duration
          </button>
        )}
    </>
  );
}
