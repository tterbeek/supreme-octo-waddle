import { useEffect, useState } from "react";
import ModalSheet from "./ModalSheet";

type SubmitResult = {
  ok: boolean;
  error?: string;
};

type EquipmentFormSheetProps = {
  title: string;
  primaryLabel: string;
  savingLabel?: string;
  initialName?: string;
  initialNotes?: string;
  onSubmit: (name: string, notes: string) => Promise<SubmitResult>;
  onClose: () => void;
};

export default function EquipmentFormSheet({
  title,
  primaryLabel,
  savingLabel = "Saving...",
  initialName = "",
  initialNotes = "",
  onSubmit,
  onClose,
}: EquipmentFormSheetProps) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setNotes(initialNotes);
    setError(null);
  }, [initialName, initialNotes]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await onSubmit(name.trim(), notes.trim());
      if (!result.ok) {
        setError(result.error || "Could not save equipment right now");
        return;
      }
      onClose();
    } catch (err) {
      console.error("[Equipment] Save error:", err);
      setError("Could not save equipment right now");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet onClose={onClose} enableDragToClose>
      <h3 className="text-lg font-semibold text-center mb-4">{title}</h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-700">Name (required)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-md p-2 mt-1"
            placeholder="e.g. Asics Gel Nimbus"
          />
          <p className="text-xs text-gray-500 mt-1">
            Give it a name you'll recognize later.
          </p>
        </div>
        <div>
          <label className="text-sm text-gray-700">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border rounded-md p-2 mt-1 resize-none"
            placeholder="Anything you want to remember about this."
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-movenotes-primary text-primary-text py-2 rounded-full border border-amber-400 font-medium disabled:opacity-60"
          >
            {saving ? savingLabel : primaryLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-gray-300 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}
