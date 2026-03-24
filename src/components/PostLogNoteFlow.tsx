import { useCallback, useState } from "react";
import AddNoteModal from "./AddNoteModal";
import Toast from "./Toast";
import type { PostLogNoteFlow } from "../hooks/usePostLogNoteFlow";

type PostLogNoteFlowProps = {
  flow: PostLogNoteFlow;
  onRefreshAfterNote: () => void;
  canPromptCircleShare?: boolean;
  onShareWithCircle?: (activityId: string) => Promise<boolean>;
  onUndoShareWithCircle?: (activityId: string) => Promise<boolean>;
};

export default function PostLogNoteFlow({
  flow,
  onRefreshAfterNote,
  canPromptCircleShare = false,
  onShareWithCircle,
  onUndoShareWithCircle,
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
  const [sharePromptActivityId, setSharePromptActivityId] = useState<string | null>(null);
  const [sharedToastActivityId, setSharedToastActivityId] = useState<string | null>(null);

  const maybeOpenSharePrompt = useCallback(() => {
    if (!canPromptCircleShare || !lastActivityId) return;
    setSharePromptActivityId(lastActivityId);
  }, [canPromptCircleShare, lastActivityId]);

  const handleSharePrompt = useCallback(
    async (activityId: string) => {
      const didShare = await onShareWithCircle?.(activityId);
      if (!didShare) return;
      setSharePromptActivityId(null);
      setSharedToastActivityId(activityId);
    },
    [onShareWithCircle]
  );

  const handleUndoShare = useCallback(
    async (activityId: string) => {
      const didUndo = await onUndoShareWithCircle?.(activityId);
      if (!didUndo) return;
      setSharedToastActivityId(null);
    },
    [onUndoShareWithCircle]
  );

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
        <Toast
          message="Notes saved to journal"
          durationMs={1500}
          icon={null}
          onClose={() => {
            closeSavedToast();
            maybeOpenSharePrompt();
          }}
        />
      )}

      {showNoteSkippedToast && (
        <Toast
          message="Notes skipped"
          durationMs={1500}
          icon={null}
          onClose={() => {
            closeSkippedToast();
            maybeOpenSharePrompt();
          }}
        />
      )}

      {sharePromptActivityId && (
        <Toast
          durationMs={8000}
          icon={null}
          onClose={() => setSharePromptActivityId(null)}
          message={
            <button
              type="button"
              className="underline"
              onClick={() => void handleSharePrompt(sharePromptActivityId)}
            >
              Share with circle
            </button>
          }
        />
      )}

      {sharedToastActivityId && (
        <Toast
          durationMs={4000}
          icon={null}
          onClose={() => setSharedToastActivityId(null)}
          message={
            <>
              Shared with your circle ·{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void handleUndoShare(sharedToastActivityId)}
              >
                Undo
              </button>
            </>
          }
        />
      )}
    </>
  );
}
