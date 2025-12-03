import ModalSheet from "./ModalSheet";
import { ACTIVITY_TYPES } from "../config/activityTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (typeId: string) => void;
}

export function SelectActivityTypeModal({ open, onClose, onSelect }: Props) {
  if (!open) return null;

  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold text-center text-gray-800 mb-4">
        Choose Activity
      </h2>

      <div className="grid grid-cols-3 gap-3">
        {Object.values(ACTIVITY_TYPES)
          .filter((t) => t.id !== "any")
          .map((t) => {
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95"
            >
              <Icon size={34} strokeWidth={1.6} />
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      <button
        className="mt-6 w-full text-center text-sm text-gray-600 hover:text-gray-800"
        onClick={onClose}
      >
        Cancel
      </button>
    </ModalSheet>
  );
}
