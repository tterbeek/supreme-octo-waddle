import { useCallback, useEffect, useState } from "react";
import {
  fetchOwnSharedActivityIds,
  shareActivityWithConnections,
  unshareActivity,
} from "../services/circle.service";

type ShareableActivity = {
  id: string;
};

type CircleShareMutationOptions = {
  silent?: boolean;
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

  const shareActivityToCircle = useCallback(
    async (activityId: string, options?: CircleShareMutationOptions) => {
      if (!userId || !activityId) return false;
      if (sharedWithCircleByActivity[activityId]) return true;

      setSharingActivityId(activityId);
      try {
        await shareActivityWithConnections(activityId, userId);
        setSharedWithCircleByActivity((prev) => ({ ...prev, [activityId]: true }));
        if (!options?.silent) {
          onToast?.("Shared with Circle");
        }
        return true;
      } catch (err: any) {
        onToast?.(err?.message || "Could not share with Circle.");
        return false;
      } finally {
        setSharingActivityId(null);
      }
    },
    [onToast, sharedWithCircleByActivity, userId]
  );

  const unshareActivityFromCircle = useCallback(
    async (activityId: string, options?: CircleShareMutationOptions) => {
      if (!userId || !activityId) return false;
      if (!sharedWithCircleByActivity[activityId]) return true;

      setSharingActivityId(activityId);
      try {
        await unshareActivity(activityId, userId);
        setSharedWithCircleByActivity((prev) => {
          const next = { ...prev };
          delete next[activityId];
          return next;
        });
        if (!options?.silent) {
          onToast?.("Removed from Circle");
        }
        return true;
      } catch (err: any) {
        onToast?.(err?.message || "Could not share with Circle.");
        return false;
      } finally {
        setSharingActivityId(null);
      }
    },
    [onToast, sharedWithCircleByActivity, userId]
  );

  const handleShareWithCircle = useCallback(
    async (activity: ShareableActivity) => {
      if (!userId || !activity?.id) return;
      const isShared = Boolean(sharedWithCircleByActivity[activity.id]);
      if (isShared) {
        await unshareActivityFromCircle(activity.id);
      } else {
        await shareActivityToCircle(activity.id);
      }
    },
    [shareActivityToCircle, sharedWithCircleByActivity, unshareActivityFromCircle, userId]
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
    shareActivityToCircle,
    unshareActivityFromCircle,
  };
}
