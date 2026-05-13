import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import DistanceDurationFields from "./quick-log/DistanceDurationFields";
import FeelingSelector from "./quick-log/FeelingSelector";
import EffortSelector from "./quick-log/EffortSelector";
import { supportsEffort } from "../config/activityTypes";

export type ActivityFormValues = {
  title: string;
  date?: string;
  distanceDisplay: string;
  duration: string;
  feeling: number | null;
  effort: number | null;
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
  metricMode?: "all" | "primaryOnly" | "optionalOnly";
  equipmentSummary?: string;
  showFeeling?: boolean;
  showEffort?: boolean;
  equipmentLabel?: string;
  hideEquipment?: boolean;
  onTitleChange: (value: string) => void;
  onDateChange?: (value: string) => void;
  onDistanceChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onShowDistance: () => void;
  onShowDuration: () => void;
  onFeelingChange: (value: number) => void;
  onEffortChange: (value: number) => void;
  onEquipmentClick?: () => void;
  renderFeelingSection?: ReactNode;
  renderAfterEquipment?: ReactNode;
};

export default function ActivityFormFields({
  values,
  unitSystem,
  showDate = true,
  metricMode = "all",
  equipmentSummary,
  showFeeling = true,
  showEffort = true,
  equipmentLabel = "Equipment",
  hideEquipment = false,
  onTitleChange,
  onDateChange,
  onDistanceChange,
  onDurationChange,
  onShowDistance,
  onShowDuration,
  onFeelingChange,
  onEffortChange,
  onEquipmentClick,
  renderFeelingSection,
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
      <div className="mb-4 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="sr-only">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-warm-200/70 bg-white/70 px-3 py-2.5 text-base text-gray-800 placeholder:text-gray-400 focus:border-movenotes-primary/30 focus:ring-2 focus:ring-movenotes-primary/20"
          />
        </div>

        {showDate && onDateChange && (
          <div className="shrink-0 rounded-full border border-warm-200/70 bg-white/70 px-2 py-2">
            <label className="sr-only">Date</label>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="compact-date-input w-[5.25rem] bg-transparent text-right text-sm text-gray-500 outline-none [color-scheme:light]"
              />
            </div>
          </div>
        )}
      </div>

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
        mode={metricMode}
      />

      {onEquipmentClick && !hideEquipment && (
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
          {showFeeling &&
            (renderFeelingSection ?? (
              <FeelingSelector value={feeling} onChange={onFeelingChange} />
            ))}
          {showEffort && supportsEffort(activityType) && (
            <EffortSelector value={effort} onChange={onEffortChange} />
          )}
        </div>
      )}

      {renderAfterEquipment}
    </>
  );
}
