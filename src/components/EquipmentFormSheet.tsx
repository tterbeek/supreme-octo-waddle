import EquipmentClassification, { type EquipmentClassificationValue } from "./EquipmentClassification";
import EquipmentActivityTypes from "./EquipmentActivityTypes";
import FormTextarea from "./forms/FormTextarea";
import { useEffect, useState } from "react";
import ModalSheet from "./ModalSheet";
import { FormActions, FormField } from "./forms/FormLayout";

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
  initialActivityTypes?: string[];
  initialClassification?: EquipmentClassificationValue;
  onSubmit: (name: string, notes: string, activityTypes: string[], classification: EquipmentClassificationValue) => Promise<SubmitResult>;
  onClose: () => void;
};

export default function EquipmentFormSheet({
  title,
  primaryLabel,
  savingLabel = "Saving...",
  initialName = "",
  initialNotes = "",
  initialActivityTypes = [],
  initialClassification,
  onSubmit,
  onClose,
}: EquipmentFormSheetProps) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const [activityTypes, setActivityTypes] = useState(initialActivityTypes);
  const initialTypeKey = [...initialActivityTypes].sort().join(",");
  const classificationKey=JSON.stringify(initialClassification??{category:null,electricAssist:null});
  const [classification,setClassification]=useState<EquipmentClassificationValue>(initialClassification??{category:null,electricAssist:null});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setNotes(initialNotes);
    setActivityTypes(initialTypeKey ? initialTypeKey.split(",") : []);
    setClassification(JSON.parse(classificationKey));
    setError(null);
  }, [initialName, initialNotes, initialTypeKey, classificationKey]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await onSubmit(name.trim(), notes.trim(), activityTypes, classification);
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
    <ModalSheet title={title} onClose={onClose} busy={saving} dirty={name !== initialName || notes !== initialNotes || [...activityTypes].sort().join(",") !== initialTypeKey || JSON.stringify(classification)!==classificationKey} presentation="dialog">
      <div className="space-y-3">
        <FormField label="Name (required)" help="Give it a name you'll recognize later.">{field => <input
            {...field}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-md p-2 mt-1"
            placeholder="e.g. Asics Gel Nimbus"
          />}</FormField>
        <FormField label="Notes (optional)">{field => <FormTextarea
            {...field}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border rounded-md p-2 mt-1 resize-none"
            placeholder="Anything you want to remember about this."
          />}</FormField>
        <EquipmentClassification value={classification} onChange={setClassification}/>
        <EquipmentActivityTypes value={activityTypes} onChange={setActivityTypes}/>
        {error && <p role="alert" className="mn-error">{error}</p>}
        <FormActions>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-movenotes-primary text-primary-text py-2 rounded-full border border-amber-400 font-medium disabled:opacity-60"
          >
            {saving ? savingLabel : primaryLabel}
          </button>
        </FormActions>
      </div>
    </ModalSheet>
  );
}
