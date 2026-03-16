import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import ModalSheet from "./ModalSheet";
import {
  createJournalEntry,
  deleteJournalEntry,
  updateJournalEntryText,
  type JournalEntryRow,
} from "../services/journalEntries.service";

type JournalEntryModalProps = {
  open: boolean;
  entry?: (Pick<JournalEntryRow, "id" | "text" | "entry_type"> & { entry_text?: string | null }) | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
};

export default function JournalEntryModal({
  open,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: JournalEntryModalProps) {
  const isEditMode = Boolean(entry?.id);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote(entry?.text ?? entry?.entry_text ?? "");
    setSaving(false);
    setDeleting(false);
    setError(null);
  }, [entry?.entry_text, entry?.id, entry?.text, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
      const valueLength = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(valueLength, valueLength);
    }, 60);

    return () => window.clearTimeout(timer);
  }, [open]);

  const trimmedNote = useMemo(() => note.trim(), [note]);
  const canSave = trimmedNote.length > 0 && !saving && !deleting;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const result =
      isEditMode && entry?.id
        ? await updateJournalEntryText(entry.id, trimmedNote)
        : await createJournalEntry(trimmedNote);

    if (result.error) {
      setError(result.error.message || "Could not save journal entry.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!entry?.id || deleting) return;
    setDeleting(true);
    setError(null);

    const result = await deleteJournalEntry(entry.id);
    if (result.error) {
      setError(result.error.message || "Could not delete journal entry.");
      setDeleting(false);
      return;
    }

    setDeleting(false);
    onDeleted?.();
    onClose();
  };

  if (!open) return null;

  return (
    <ModalSheet
      onClose={onClose}
      sheetClassName="max-w-md sm:max-w-2xl max-h-[96vh] overflow-y-auto sm:rounded-2xl sm:mt-20"
    >
      <h2 className="text-lg font-semibold text-center mb-4">
        {isEditMode ? "Edit journal entry" : "Journal entry"}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-700">Notes</label>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={8}
            placeholder="Write what is on your mind..."
            className="w-full rounded-xl bg-white/70 border border-warm-200/70 p-4 mt-1 text-base text-gray-800 placeholder:text-gray-400 resize-none focus:ring-2 focus:ring-movenotes-primary/30 focus:border-movenotes-primary/30 transition"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="bg-movenotes-primary text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5 disabled:opacity-50 mt-5"
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {isEditMode && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving || deleting}
          className="w-full mt-3 py-3 border border-movenotes-accent text-movenotes-accent rounded-full text-sm font-medium hover:bg-movenotes-accent/10 transition disabled:opacity-50"
        >
          {deleting ? "Deleting..." : (<>
            <Trash2 className="inline w-4 h-4 mr-1 -mt-0.5" />
            Delete Entry
          </>)}
        </button>
      )}
    </ModalSheet>
  );
}
