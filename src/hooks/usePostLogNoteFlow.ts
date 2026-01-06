import { useCallback, useState } from "react";

export type PostLogNoteFlow = {
  lastActivityId: string | null;
  showLogToast: boolean;
  showNotePrompt: boolean;
  showNoteSavedToast: boolean;
  showNoteSkippedToast: boolean;
  handleLogged: (activityId: string) => void;
  handleLogToastClose: () => void;
  handleNoteSaved: (afterRefresh?: () => void) => void;
  handleNoteSkipped: (afterRefresh?: () => void) => void;
  closeSavedToast: () => void;
  closeSkippedToast: () => void;
};

export function usePostLogNoteFlow(): PostLogNoteFlow {
  const [lastActivityId, setLastActivityId] = useState<string | null>(null);
  const [showLogToast, setShowLogToast] = useState(false);
  const [showNotePrompt, setShowNotePrompt] = useState(false);
  const [showNoteSavedToast, setShowNoteSavedToast] = useState(false);
  const [showNoteSkippedToast, setShowNoteSkippedToast] = useState(false);

  const handleLogged = useCallback((activityId: string) => {
    setLastActivityId(activityId);
    setShowLogToast(true);
  }, []);

  const handleLogToastClose = useCallback(() => {
    setShowLogToast(false);
    if (lastActivityId) {
      setTimeout(() => setShowNotePrompt(true), 250);
    }
  }, [lastActivityId]);

  const handleNoteSaved = useCallback((afterRefresh?: () => void) => {
    setShowNotePrompt(false);
    setShowNoteSavedToast(true);
    afterRefresh?.();
  }, []);

  const handleNoteSkipped = useCallback((afterRefresh?: () => void) => {
    setShowNotePrompt(false);
    setShowNoteSkippedToast(true);
    afterRefresh?.();
  }, []);

  const closeSavedToast = useCallback(() => setShowNoteSavedToast(false), []);
  const closeSkippedToast = useCallback(
    () => setShowNoteSkippedToast(false),
    []
  );

  return {
    lastActivityId,
    showLogToast,
    showNotePrompt,
    showNoteSavedToast,
    showNoteSkippedToast,
    handleLogged,
    handleLogToastClose,
    handleNoteSaved,
    handleNoteSkipped,
    closeSavedToast,
    closeSkippedToast,
  };
}
