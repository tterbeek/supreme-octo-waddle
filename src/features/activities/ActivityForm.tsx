import type { ReactNode } from "react";
import ActivityFormFields, { type ActivityFormValues } from "../../components/ActivityFormFields";

type ActivityFormProps = {
  values: ActivityFormValues;
  unitSystem: string;
  onTitleChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onDistanceChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onShowDistance: () => void;
  onShowDuration: () => void;
  onFeelingChange: (value: number) => void;
  onEffortChange: (value: number) => void;
  equipmentSummary?: string;
  onEquipmentClick?: () => void;
  renderAfterEquipment?: ReactNode;
};

export default function ActivityForm({
  values,
  unitSystem,
  onTitleChange,
  onDateChange,
  onDistanceChange,
  onDurationChange,
  onShowDistance,
  onShowDuration,
  onFeelingChange,
  onEffortChange,
  equipmentSummary,
  onEquipmentClick,
  renderAfterEquipment,
}: ActivityFormProps) {
  return (
    <ActivityFormFields
      values={values}
      unitSystem={unitSystem}
      equipmentSummary={equipmentSummary}
      onTitleChange={onTitleChange}
      onDateChange={onDateChange}
      onDistanceChange={onDistanceChange}
      onDurationChange={onDurationChange}
      onShowDistance={onShowDistance}
      onShowDuration={onShowDuration}
      onFeelingChange={onFeelingChange}
      onEffortChange={onEffortChange}
      onEquipmentClick={onEquipmentClick}
      renderAfterEquipment={renderAfterEquipment}
    />
  );
}
