import type { ReactNode } from "react";
import DistanceDurationFields from "./quick-log/DistanceDurationFields";
import FeelingSelector from "./quick-log/FeelingSelector";
import EffortSelector from "./quick-log/EffortSelector";
import { supportsEffort } from "../config/activityTypes";

export type ActivityFormValues = {
  title: string;
  date?: string;
  distanceDisplay: string;
  duration: string;
  feeling: number;
  effort: number;
  activityType: string;
  defaultFields: string[];
  optionalFields: string[];
  showOptionalDistance: boolean;
  showOptionalDuration: boolean;
};

type ActivityFormFieldsProps = {
  values: ActivityFormValues;
  unitSystem: string;
  showDate?: boolean;
  equipmentSummary?: string;
  showFeeling?: boolean;
  showEffort?: boolean;
  equipmentLabel?: string;
  onTitleChange: (value: string) => void;
  onDateChange?: (value: string) => void;
  onDistanceChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onShowDistance: () => void;
  onShowDuration: () => void;
  onFeelingChange: (value: number) => void;
  onEffortChange: (value: number) => void;
  onEquipmentClick?: () => void;
  renderAfterEquipment?: ReactNode;
};

export default function ActivityFormFields({
  values,
  unitSystem,
  showDate = true,
  equipmentSummary,
  showFeeling = true,
  showEffort = true,
  equipmentLabel = "Equipment",
  onTitleChange,
  onDateChange,
  onDistanceChange,
  onDurationChange,
  onShowDistance,
  onShowDuration,
  onFeelingChange,
  onEffortChange,
  onEquipmentClick,
  renderAfterEquipment,
}: ActivityFormFieldsProps) {
  const {
    title,
    date,
    distanceDisplay,
    duration,
    feeling,
    effort,
    activityType,
    defaultFields,
    optionalFields,
    showOptionalDistance,
    showOptionalDuration,
  } = values;

  return (
    <>
      <label className="text-sm text-gray-600">Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full border rounded-md p-2 mb-4"
      />

      {showDate && onDateChange && (
        <>
          <label className="text-sm text-gray-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full border rounded-md p-2 mb-4"
          />
        </>
      )}

      <DistanceDurationFields
        defaultFields={defaultFields}
        optionalFields={optionalFields}
        showOptionalDistance={showOptionalDistance}
        showOptionalDuration={showOptionalDuration}
        displayDistance={distanceDisplay}
        duration={duration}
        unitSystem={unitSystem}
        onDistanceChange={onDistanceChange}
        onDurationChange={onDurationChange}
        onShowDistance={onShowDistance}
        onShowDuration={onShowDuration}
      />

      {onEquipmentClick && (
        <div className="mt-1 mb-4">
          {equipmentSummary ? (
            <button
              type="button"
              onClick={onEquipmentClick}
              className="block w-full text-left border border-warm-200 rounded-md p-3"
            >
              <div className="text-sm text-gray-600">{equipmentLabel}</div>
              <div className="text-base text-gray-900">{equipmentSummary}</div>
            </button>
          ) : (
            <button
              type="button"
              className="block text-movenotes-primary text-sm underline"
              onClick={onEquipmentClick}
            >
              + Add equipment
            </button>
          )}
        </div>
      )}

      {(showFeeling || showEffort) && (
        <div className="mb-4 flex flex-col items-center gap-4">
          {showFeeling && <FeelingSelector value={feeling} onChange={onFeelingChange} />}
          {showEffort && supportsEffort(activityType) && (
            <EffortSelector value={effort} onChange={onEffortChange} />
          )}
        </div>
      )}

      {renderAfterEquipment}
    </>
  );
}
