import { useCallback, useState } from "react";

type NoteShareStatus = {
  activityId: string;
  type: "saved" | "skipped";
};

type UseCircleSharePromptSequenceArgs = {
  canPromptCircleShare: boolean;
  onShareWithCircle: (activityId: string) => Promise<boolean>;
  onUndoShareWithCircle: (activityId: string) => Promise<boolean>;
};

export function useCircleSharePromptSequence({
  canPromptCircleShare,
  onShareWithCircle,
  onUndoShareWithCircle,
}: UseCircleSharePromptSequenceArgs) {
  const [statusToast, setStatusToast] = useState<NoteShareStatus | null>(null);
  const [sharePromptActivityId, setSharePromptActivityId] = useState<string | null>(null);
  const [sharedToastActivityId, setSharedToastActivityId] = useState<string | null>(null);

  const showSavedStatus = useCallback((activityId: string) => {
    setStatusToast({ activityId, type: "saved" });
  }, []);

  const showSkippedStatus = useCallback((activityId: string) => {
    setStatusToast({ activityId, type: "skipped" });
  }, []);

  const closeStatusToast = useCallback(() => {
    setStatusToast((current) => {
      if (current && canPromptCircleShare) {
        setSharePromptActivityId(current.activityId);
      }
      return null;
    });
  }, [canPromptCircleShare]);

  const handleSharePrompt = useCallback(
    async (activityId: string) => {
      const didShare = await onShareWithCircle(activityId);
      if (!didShare) return;
      setSharePromptActivityId(null);
      setSharedToastActivityId(activityId);
    },
    [onShareWithCircle]
  );

  const handleUndoShare = useCallback(
    async (activityId: string) => {
      const didUndo = await onUndoShareWithCircle(activityId);
      if (!didUndo) return;
      setSharedToastActivityId(null);
    },
    [onUndoShareWithCircle]
  );

  return {
    statusToast,
    sharePromptActivityId,
    sharedToastActivityId,
    showSavedStatus,
    showSkippedStatus,
    closeStatusToast,
    handleSharePrompt,
    handleUndoShare,
    dismissSharePrompt: () => setSharePromptActivityId(null),
    dismissSharedToast: () => setSharedToastActivityId(null),
  };
}
