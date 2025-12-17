import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFeedPage } from "../services/activities.service";

const FEED_PAGE_SIZE = 20;

const sortActivitiesByDateAndCreated = (items: any[]) =>
  [...items].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;

    const bCreated =
      (b.created_at && new Date(b.created_at).getTime()) ||
      (b.inserted_at && new Date(b.inserted_at).getTime()) ||
      (b.updated_at && new Date(b.updated_at).getTime()) ||
      0;
    const aCreated =
      (a.created_at && new Date(a.created_at).getTime()) ||
      (a.inserted_at && new Date(a.inserted_at).getTime()) ||
      (a.updated_at && new Date(a.updated_at).getTime()) ||
      0;

    return bCreated - aCreated;
  });

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
    const { data: firstFeed } = await fetchFeedPage(userId, FEED_PAGE_SIZE, 0);
    setActivities(sortActivitiesByDateAndCreated(firstFeed || []));
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
      const { data: more } = await fetchFeedPage(userId, FEED_PAGE_SIZE, offset);
      if (!more || more.length === 0) {
        setHasMoreFeed(false);
        return;
      }
      setActivities((prev) => sortActivitiesByDateAndCreated([...prev, ...more]));
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
    return activities.filter((a) => {
      return (
        a.title?.toLowerCase().includes(normalizedSearch) ||
        a.notes?.toLowerCase().includes(normalizedSearch) ||
        a.type?.toLowerCase().includes(normalizedSearch)
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
