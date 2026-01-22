import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import ModalSheet from "./ModalSheet";
import type { Equipment } from "../types";
import EquipmentFormSheet from "./EquipmentFormSheet";

type EquipmentDialogProps = {
  equipment: Equipment[];
  selectedEquipmentIds: string[];
  onChange: (ids: string[]) => void;
  onAddEquipment: (name: string, notes: string) => Promise<Equipment | null>;
  onClose: () => void;
};

export default function EquipmentDialog({
  equipment,
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

  const handleAddEquipment = async (name: string, notes: string) => {
    const created = await onAddEquipment(name, notes);
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

  return (
    <ModalSheet onClose={handleCancel} enableDragToClose>
      <h2 className="text-lg font-semibold text-center mb-4">Equipment</h2>

      <div className="mb-5">
        <div className="text-sm text-gray-600 mb-2">Existing equipment</div>
        <div className="max-h-[40vh] overflow-y-auto flex flex-col gap-2 pr-1">
          {equipment.length === 0 && (
            <p className="text-sm text-gray-500">
              No equipment yet. Add your first item below.
            </p>
          )}
          {equipment.map((item) => {
            const checked = localSelected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
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

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleDone}
          className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full font-medium"
        >
          Done
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-full font-medium"
        >
          Cancel
        </button>
      </div>

      {showAddForm && (
        <EquipmentFormSheet
          title="Add new equipment"
          primaryLabel="Add equipment"
          savingLabel="Adding..."
          onSubmit={handleAddEquipment}
          onClose={closeAddForm}
        />
      )}
    </ModalSheet>
  );
}
