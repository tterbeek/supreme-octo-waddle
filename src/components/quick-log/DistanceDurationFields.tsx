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
}: DistanceDurationFieldsProps) {
  return (
    <>
      {(defaultFields.includes("distance_km") || showOptionalDistance) && (
        <div className="form-group mb-4">
          <label className="text-sm text-gray-600">
            Distance ({unitSystem === "imperial" ? "mi" : "km"})
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={displayDistance}
            onChange={(e) => onDistanceChange(e.target.value)}
            className="w-full border rounded-md p-2"
          />
        </div>
      )}

      {!defaultFields.includes("distance_km") &&
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

      {(defaultFields.includes("duration_min") || showOptionalDuration) && (
        <div className="form-group mb-4">
          <label className="text-sm text-gray-600">Duration (min)</label>
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => onDurationChange(e.target.value)}
            className="w-full border rounded-md p-2"
          />
        </div>
      )}

      {!defaultFields.includes("duration_min") &&
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
