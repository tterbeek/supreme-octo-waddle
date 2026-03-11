import { useCallback, useEffect, useState } from "react";
import {
  fetchOwnSharedActivityIds,
  shareActivityWithConnections,
  unshareActivity,
} from "../services/circle.service";

type ShareableActivity = {
  id: string;
};

type UseCircleActivitySharingArgs = {
  userId: string | null;
  circleEnabled: boolean;
  activityIds: string[];
  onToast?: (message: string) => void;
};

export function useCircleActivitySharing({
  userId,
  circleEnabled,
  activityIds,
  onToast,
}: UseCircleActivitySharingArgs) {
  const [sharingActivityId, setSharingActivityId] = useState<string | null>(null);
  const [sharedWithCircleByActivity, setSharedWithCircleByActivity] = useState<
    Record<string, boolean>
  >({});

  const handleShareWithCircle = useCallback(
    async (activity: ShareableActivity) => {
      if (!userId || !activity?.id) return;
      setSharingActivityId(activity.id);
      try {
        const isShared = Boolean(sharedWithCircleByActivity[activity.id]);
        if (isShared) {
          await unshareActivity(activity.id, userId);
          setSharedWithCircleByActivity((prev) => {
            const next = { ...prev };
            delete next[activity.id];
            return next;
          });
          onToast?.("Removed from Circle");
        } else {
          await shareActivityWithConnections(activity.id, userId);
          setSharedWithCircleByActivity((prev) => ({ ...prev, [activity.id]: true }));
          onToast?.("Shared with Circle");
        }
      } catch (err: any) {
        onToast?.(err?.message || "Could not share with Circle.");
      } finally {
        setSharingActivityId(null);
      }
    },
    [onToast, sharedWithCircleByActivity, userId]
  );

  useEffect(() => {
    if (!userId || !circleEnabled) {
      setSharedWithCircleByActivity({});
      return;
    }

    const uniqueActivityIds = Array.from(new Set(activityIds.filter(Boolean)));
    if (!uniqueActivityIds.length) {
      setSharedWithCircleByActivity({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const sharedIds = await fetchOwnSharedActivityIds(userId, uniqueActivityIds);
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        sharedIds.forEach((id) => {
          next[id] = true;
        });
        setSharedWithCircleByActivity(next);
      } catch {
        if (!cancelled) {
          setSharedWithCircleByActivity({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activityIds, circleEnabled, userId]);

  return {
    sharingActivityId,
    sharedWithCircleByActivity,
    handleShareWithCircle,
  };
}
