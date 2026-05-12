import { useLayoutEffect, useRef, useState } from "react";

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
  mode?: "all" | "primaryOnly" | "optionalOnly";
};

type InlineUnitInputProps = {
  type?: "number" | "text";
  inputMode: "decimal" | "numeric";
  step?: number;
  min?: number;
  value: string;
  placeholder: string;
  unit: string;
  onChange: (value: string) => void;
};

function InlineUnitInput({
  type = "number",
  inputMode,
  step,
  min,
  value,
  placeholder,
  unit,
  onChange,
}: InlineUnitInputProps) {
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [valueWidth, setValueWidth] = useState(0);

  useLayoutEffect(() => {
    setValueWidth(measureRef.current?.offsetWidth ?? 0);
  }, [value]);

  return (
    <div className="relative">
      <input
        type={type}
        inputMode={inputMode}
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-warm-200/70 bg-white/70 px-3 py-2.5 pr-12 text-base text-gray-800 placeholder:text-gray-400 focus:border-movenotes-primary/30 focus:ring-2 focus:ring-movenotes-primary/20"
      />
      {value ? (
        <>
          <span
            ref={measureRef}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 whitespace-pre text-base text-transparent"
            aria-hidden="true"
          >
            {value}
          </span>
          <span
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-base text-gray-400"
            style={{ left: `calc(0.75rem + ${valueWidth}px + 0.25rem)` }}
            aria-hidden="true"
          >
            {unit}
          </span>
        </>
      ) : null}
    </div>
  );
}

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
  mode = "all",
}: DistanceDurationFieldsProps) {
  const distanceVisible =
    mode === "primaryOnly"
      ? defaultFields.includes("distance_km")
      : mode === "optionalOnly"
      ? (showOptionalDistance || forceShowOptional) &&
        optionalFields.includes("distance_km") &&
        !defaultFields.includes("distance_km")
      : defaultFields.includes("distance_km") || showOptionalDistance || forceShowOptional;
  const durationVisible =
    mode === "primaryOnly"
      ? defaultFields.includes("duration_min")
      : mode === "optionalOnly"
      ? (showOptionalDuration || forceShowOptional) &&
        optionalFields.includes("duration_min") &&
        !defaultFields.includes("duration_min")
      : defaultFields.includes("duration_min") || showOptionalDuration || forceShowOptional;
  const spacing = dense ? "mb-3" : "mb-4";

  return (
    <>
      {distanceVisible && (
        <div className={`form-group ${spacing}`}>
          <InlineUnitInput
            inputMode="decimal"
            value={displayDistance}
            onChange={onDistanceChange}
            placeholder={`Distance in ${unitSystem === "imperial" ? "mi" : "km"}`}
            unit={unitSystem === "imperial" ? "mi" : "km"}
          />
        </div>
      )}

      {!suppressAddButtons &&
        mode !== "primaryOnly" &&
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
          <InlineUnitInput
            inputMode="numeric"
            step={1}
            min={0}
            value={duration}
            onChange={onDurationChange}
            placeholder="Duration in min"
            unit="min"
          />
        </div>
      )}

      {!suppressAddButtons &&
        mode !== "primaryOnly" &&
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
