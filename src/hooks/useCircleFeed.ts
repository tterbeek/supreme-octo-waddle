import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CIRCLE_REACTIONS_UPDATED_EVENT,
  fetchCircleConnectionState,
  getCircleFeed,
  hasCircleAccess,
  markCircleFeedVisited,
  markCircleFeedItemSeen,
  type CircleFeedItem,
} from "../services/circle.service";

const DEFAULT_PAGE_SIZE = 30;

export function useCircleFeed(userId: string | null, pageSize = DEFAULT_PAGE_SIZE) {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<CircleFeedItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [circleAccess, setCircleAccess] = useState(false);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const markUnseenAsSeen = useCallback(async (uid: string, rows: CircleFeedItem[]) => {
    const unseen = rows.filter((row) => !row.seen_at).map((row) => row.recipient_id);
    if (!unseen.length) return;

    await Promise.allSettled(
      unseen.map((recipientId) => markCircleFeedItemSeen(recipientId, uid))
    );

    setFeed((prev) =>
      prev.map((row) =>
        unseen.includes(row.recipient_id) && !row.seen_at
          ? { ...row, seen_at: new Date().toISOString() }
          : row
      )
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError(null);
      setFeed([]);
      setHasMore(false);
      setCircleAccess(false);
      setAcceptedCount(0);
      setPendingCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [access, connectionState, rows] = await Promise.all([
        hasCircleAccess(userId),
        fetchCircleConnectionState(userId),
        getCircleFeed({ userId, limit: pageSize }),
      ]);
      setCircleAccess(access);
      setAcceptedCount(connectionState.acceptedCount);
      setPendingCount(connectionState.pendingCount);
      setFeed(rows);
      setHasMore(rows.length === pageSize);
      void markUnseenAsSeen(userId, rows);
      void markCircleFeedVisited(userId)
        .then(() => {
          window.dispatchEvent(new Event(CIRCLE_REACTIONS_UPDATED_EVENT));
        })
        .catch(() => {
          /* best-effort: dot clear state is refreshed elsewhere */
        });
    } catch (err: any) {
      setError(err?.message || "Could not load Circle feed.");
    } finally {
      setLoading(false);
    }
  }, [markUnseenAsSeen, pageSize, userId]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || loadingMore || feed.length === 0) return;
    setLoadingMore(true);
    setError(null);
    try {
      const last = feed[feed.length - 1];
      const rows = await getCircleFeed({
        userId,
        limit: pageSize,
        beforeOccurredOn: last.occurred_on,
        beforeSharedAt: last.shared_at,
        beforeRecipientId: last.recipient_id,
      });
      if (!rows.length) {
        setHasMore(false);
        return;
      }
      setFeed((prev) => [...prev, ...rows]);
      setHasMore(rows.length === pageSize);
      void markUnseenAsSeen(userId, rows);
    } catch (err: any) {
      setError(err?.message || "Could not load more Circle items.");
    } finally {
      setLoadingMore(false);
    }
  }, [feed, hasMore, loadingMore, markUnseenAsSeen, pageSize, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const emptyState = useMemo(() => {
    if (acceptedCount === 0 && pendingCount > 0) {
      return "You have pending Circle requests. Accepted connections can share summaries here.";
    }
    return "Nothing shared yet. When people in your circle share a movement summary, it will appear here.";
  }, [acceptedCount, pendingCount]);

  return {
    loading,
    loadingMore,
    error,
    feed,
    hasMore,
    circleAccess,
    acceptedCount,
    pendingCount,
    emptyState,
    refresh,
    loadMore,
  };
}
