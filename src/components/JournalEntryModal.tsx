import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

    const result = isEditMode && entry?.id
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

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-warm-200 bg-warm-100 shadow-xl p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Journal entry</h2>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={8}
          placeholder="Write what is on your mind..."
          className="w-full rounded-xl border border-warm-200 bg-white/80 px-4 py-3 text-base text-gray-900 outline-none focus:border-movenotes-primary focus:ring-2 focus:ring-movenotes-primary/20 resize-y"
        />

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            {isEditMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="text-sm font-medium text-red-600 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="text-sm font-medium text-gray-600 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-full bg-movenotes-primary px-4 py-2 text-sm font-semibold text-primary-text disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
