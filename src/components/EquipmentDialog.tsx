import { ACTIVITY_TYPES } from "../config/activityTypes";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import ModalSheet from "./ModalSheet";
import type { Equipment } from "../types";
import EquipmentFormSheet from "./EquipmentFormSheet";
import { FormActions } from "./forms/FormLayout";

type EquipmentDialogProps = {
  equipment: Equipment[];
  activityType?: string;
  selectedEquipmentIds: string[];
  onChange: (ids: string[]) => void;
  onAddEquipment: (name: string, notes: string, activityTypes?: string[]) => Promise<Equipment | null>;
  onClose: () => void;
};

export default function EquipmentDialog({
  equipment,
  activityType,
  selectedEquipmentIds,
  onChange,
  onAddEquipment,
  onClose,
}: EquipmentDialogProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedEquipmentIds);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    setLocalSelected(selectedEquipmentIds);
  }, [selectedEquipmentIds]);

  const toggleSelection = (id: string) => {
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const closeAddForm = () => {
    setShowAddForm(false);
  };

  const handleAddEquipment = async (name: string, notes: string, activityTypes: string[]) => {
    const created = await onAddEquipment(name, notes, activityTypes);
    if (!created) {
      return { ok: false, error: "Could not add equipment right now" };
    }
    setLocalSelected((prev) =>
      prev.includes(created.id) ? prev : [...prev, created.id]
    );
    return { ok: true };
  };

  const handleDone = () => {
    onChange(localSelected);
    onClose();
  };

  const handleCancel = () => {
    setLocalSelected(selectedEquipmentIds);
    closeAddForm();
    onClose();
  };

  const groups = activityType
    ? [
        { label: `For ${ACTIVITY_TYPES[activityType]?.label ?? "this activity type"}`, items: equipment.filter(item=>item.activity_types?.includes(activityType)) },
        { label: "Other equipment", items: equipment.filter(item=>!item.activity_types?.includes(activityType)) },
      ]
    : [{ label: "Existing equipment", items: equipment }];

  return (
    <ModalSheet title="Equipment" onClose={handleCancel} dirty={JSON.stringify([...localSelected].sort()) !== JSON.stringify([...selectedEquipmentIds].sort())}>

      <div className="mb-5">
        {groups.filter((group,index)=>group.items.length>0 || (index===0&&equipment.length>0)).map(group=><section key={group.label} aria-label={group.label} className="mb-4">
        <h3 className="text-sm text-gray-600 mb-2">{group.label}</h3>
        <div className="flex flex-col gap-2">
          {!group.items.length && <p className="text-sm text-gray-500">No equipment linked to this activity type yet.</p>}
          {group.items.map((item) => {
            const checked = localSelected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={checked}
                onClick={() => toggleSelection(item.id)}
                className={`flex items-center justify-between w-full border rounded-xl px-3 py-2 transition text-left ${
                  checked
                    ? "border-amber-300 bg-amber-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      checked
                        ? "bg-amber-400 border-amber-400 text-white"
                        : "border-gray-300 text-transparent"
                    }`}
                  >
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  </span>
                  <span className="text-sm text-gray-800">{item.name}</span>
                </div>
              </button>
            );
          })}
        </div>
        </section>)}
        {!equipment.length&&<p className="text-sm text-gray-500">No equipment yet. Add your first item below.</p>}
      </div>

      <div className="border-t border-gray-200 pt-4">
        {!showAddForm && (
          <button
            type="button"
            className="text-movenotes-primary text-sm underline"
            onClick={() => setShowAddForm(true)}
          >
            + Add new equipment
          </button>
        )}
      </div>

      <FormActions>
        <button
          type="button"
          onClick={handleDone}
          className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full font-medium"
        >
          Done
        </button>
      </FormActions>

      {showAddForm && (
        <EquipmentFormSheet
          title="Add new equipment"
          primaryLabel="Add equipment"
          initialActivityTypes={activityType ? [activityType] : []}
          savingLabel="Adding..."
          onSubmit={handleAddEquipment}
          onClose={closeAddForm}
        />
      )}
    </ModalSheet>
  );
}
