import ActivityFormFields, { type ActivityFormValues } from "../../components/ActivityFormFields";

type PresetFormProps = {
  values: ActivityFormValues & { name: string };
  unitSystem: string;
  onNameChange: (value: string) => void;
  onDistanceChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onShowDistance: () => void;
  onShowDuration: () => void;
  onEffortChange: (value: number) => void;
  equipmentSummary?: string;
  onEquipmentClick?: () => void;
};

export default function PresetForm({
  values,
  unitSystem,
  onNameChange,
  onDistanceChange,
  onDurationChange,
  onShowDistance,
  onShowDuration,
  onEffortChange,
  equipmentSummary,
  onEquipmentClick,
}: PresetFormProps) {
  return (
    <div>
      <label className="text-sm text-gray-600">Name</label>
      <input
        type="text"
        value={values.name}
        onChange={(e) => onNameChange(e.target.value)}
        className="w-full border rounded-md p-2 mb-4"
        placeholder="Morning Tempo"
      />

      <ActivityFormFields
        values={values}
        unitSystem={unitSystem}
        showDate={false}
        showFeeling={false}
        onTitleChange={() => {}}
        onDistanceChange={onDistanceChange}
        onDurationChange={onDurationChange}
        onShowDistance={onShowDistance}
        onShowDuration={onShowDuration}
        onFeelingChange={() => {}}
        onEffortChange={onEffortChange}
        equipmentSummary={equipmentSummary}
        equipmentLabel="Equipment"
        onEquipmentClick={onEquipmentClick}
      />
    </div>
  );
}
