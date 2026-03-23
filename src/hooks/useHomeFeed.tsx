import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFeedPage } from "../services/activities.service";
import {
  ACTIVITY_LOCATION_UPDATED_EVENT,
  type ActivityLocationUpdatedDetail,
} from "../services/activityLocation.service";

const FEED_PAGE_SIZE = 20;

const sortFeedRows = (items: any[]) => [...items];

export function useHomeFeed(userId: string | null) {
  const [activities, setActivities] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [feedOffset, setFeedOffset] = useState(0);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [initialFeedLoaded, setInitialFeedLoaded] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const { data: firstFeed } = await fetchFeedPage(FEED_PAGE_SIZE, 0);
    setActivities(sortFeedRows(firstFeed || []));
    setFeedOffset(firstFeed ? firstFeed.length : 0);
    setHasMoreFeed(!!firstFeed && firstFeed.length === FEED_PAGE_SIZE);
    setInitialFeedLoaded(true);
    setIsLoading(false);
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!hasMoreFeed || !userId) return;
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    try {
      const offset = feedOffset;
      const { data: more } = await fetchFeedPage(FEED_PAGE_SIZE, offset);
      if (!more || more.length === 0) {
        setHasMoreFeed(false);
        return;
      }
      setActivities((prev) => sortFeedRows([...prev, ...more]));
      setFeedOffset((prev) => prev + more.length);
      if (more.length < FEED_PAGE_SIZE) {
        setHasMoreFeed(false);
      }
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [feedOffset, hasMoreFeed, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleLocationUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ActivityLocationUpdatedDetail>).detail;
      if (!detail?.activityId) return;

      setActivities((prev) =>
        prev.map((item) =>
          item?.id === detail.activityId
            ? { ...item, locationTag: detail.locationTag }
            : item
        )
      );
    };

    window.addEventListener(
      ACTIVITY_LOCATION_UPDATED_EVENT,
      handleLocationUpdate as EventListener
    );
    return () => {
      window.removeEventListener(
        ACTIVITY_LOCATION_UPDATED_EVENT,
        handleLocationUpdate as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  const filteredActivities = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    if (!normalizedSearch) return activities;
    return activities.filter((a) => {
      const metadata =
        a.metadata && typeof a.metadata === "object" ? a.metadata : null;
      const metaText =
        metadata?.tiny_tweak_text || metadata?.tweak_text || metadata?.tweakText;
      const haystack = [
        a.title,
        a.notes,
        a.type,
        a.locationTag?.value,
        a.entry_text,
        a.text,
        metaText,
      ];
      return haystack.some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [activities, searchTerm]);

  return {
    activities,
    setActivities,
    filteredActivities,
    refresh,
    loadMore,
    hasMoreFeed,
    isLoading,
    initialFeedLoaded,
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
  };
}
