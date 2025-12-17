import { useState } from "react";

export function useHomeNotes() {
  const [lastActivityId, setLastActivityId] = useState<string | null>(null);
  const [showNotePrompt, setShowNotePrompt] = useState(false);
  const [showNoteSkippedToast, setShowNoteSkippedToast] = useState(false);
  const [showNoteSavedToast, setShowNoteSavedToast] = useState(false);

  return {
    lastActivityId,
    setLastActivityId,
    showNotePrompt,
    setShowNotePrompt,
    showNoteSkippedToast,
    setShowNoteSkippedToast,
    showNoteSavedToast,
    setShowNoteSavedToast,
  };
}
