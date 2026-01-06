import AddNoteModal from "./AddNoteModal";
import Toast from "./Toast";
import type { PostLogNoteFlow } from "../hooks/usePostLogNoteFlow";

type PostLogNoteFlowProps = {
  flow: PostLogNoteFlow;
  onRefreshAfterNote: () => void;
};

export default function PostLogNoteFlow({
  flow,
  onRefreshAfterNote,
}: PostLogNoteFlowProps) {
  const {
    lastActivityId,
    showLogToast,
    showNotePrompt,
    showNoteSavedToast,
    showNoteSkippedToast,
    handleLogToastClose,
    handleNoteSaved,
    handleNoteSkipped,
    closeSavedToast,
    closeSkippedToast,
  } = flow;

  return (
    <>
      {showLogToast && (
        <Toast message="Activity logged ✅" onClose={handleLogToastClose} />
      )}

      {showNotePrompt && lastActivityId && (
        <AddNoteModal
          activityId={lastActivityId}
          onSave={() => {
            handleNoteSaved(onRefreshAfterNote);
          }}
          onSkip={() => {
            handleNoteSkipped();
          }}
        />
      )}

      {showNoteSavedToast && (
        <Toast message="Note saved 💾" onClose={closeSavedToast} />
      )}

      {showNoteSkippedToast && (
        <Toast message="Note skipped ✋" onClose={closeSkippedToast} />
      )}
    </>
  );
}
