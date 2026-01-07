import { Compass, Sparkles } from "lucide-react";
import ModalSheet from "./ModalSheet";

type DirectionAddModalProps = {
  open: boolean;
  onClose: () => void;
  onSelectDirection: () => void;
  onSelectMicroAdjustment?: () => void;
};

export default function DirectionAddModal({
  open,
  onClose,
  onSelectDirection,
  onSelectMicroAdjustment,
}: DirectionAddModalProps) {
  if (!open) return null;

  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold text-center text-gray-800 mb-4">
        Add something new
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onSelectDirection}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95"
        >
          <Compass size={34} strokeWidth={1.6} />
          <span className="text-sm font-medium">Direction</span>
          <span className="text-xs text-gray-600">Longer-term</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMicroAdjustment?.()}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95"
        >
          <Sparkles size={34} strokeWidth={1.6} />
          <span className="text-sm font-medium">Tiny tweak</span>
          <span className="text-xs text-gray-600">Short-term</span>
        </button>
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
