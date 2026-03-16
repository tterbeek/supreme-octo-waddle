import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List } from "react-window";
import type { ListImperativeAPI, RowComponentProps } from "react-window";
import { supabase } from "../supabaseClient";
import ModalSheet from "../components/ModalSheet";
import AddBottomSheet from "../components/AddBottomSheet";
import AddActivityModal from "../features/activities/AddActivityModal";
import EditActivityModal from "../features/activities/EditActivityModal";
import { useHomeModals } from "../hooks/useHomeModals";
import { getCurrentUser } from "../services/auth.service";
import { useUnitSystem } from "../contexts/UnitContext";
import RecentActivityCard from "../components/RecentActivityCard";
import JournalEntryCard from "../components/JournalEntryCard";
import JournalEntryModal from "../components/JournalEntryModal";
import Toast from "../components/Toast";
import { useNoteImages } from "../hooks/useNoteImages";
import GalleryLightbox from "../components/GalleryLightbox";
import { useGalleryLightbox } from "../hooks/useGalleryLightbox";
import { NOTE_STORAGE_BUCKET, signStorageValues } from "../services/storage.service";
import { fetchJournalEntriesInRange } from "../services/journalEntries.service";
import PostLogNoteFlow from "../components/PostLogNoteFlow";
import { usePostLogNoteFlow } from "../hooks/usePostLogNoteFlow";
import { buildGalleryItemsForActivity } from "../lib/photos";
import { STRAVA_SYNC_COMPLETED_EVENT } from "../services/strava.service";
import {
  hasCircleAccess,
} from "../services/circle.service";
import { useCircleActivitySharing } from "../hooks/useCircleActivitySharing";

type CalendarActivity = {
  entry_kind?: "activity";
  id: string;
  date: string;
  type: string;
  source?: string | null;
  raw_sport_type?: string | null;
  raw_type?: string | null;
  started_at?: string | null;
  title?: string | null;
  notes?: string | null;
  distance_km?: number | null;
  duration_min?: number | null;
  effort?: number | null;
  feeling?: number | null;
  created_at?: string | null;
  note_image_url?: string | null;
  note_thumb_image_url?: string | null;
  photos?: Array<{
    id: string;
    image_path?: string | null;
    thumb_path?: string | null;
    sort_order?: number | null;
    created_at?: string | null;
  }>;
  equipment?: Array<{
    id: string;
    name: string;
    notes?: string | null;
    is_active?: boolean | null;
  }>;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarJournalEntry = {
  id: string;
  entry_kind: "journal_entry";
  entry_type: string;
  text: string;
  entry_text: string;
  created_at: string;
  journal_created_at: string;
  metadata?: Record<string, unknown> | null;
};

type CalendarFeedEntry = CalendarActivity | CalendarJournalEntry;

const EMPTY_DAY_ENTRIES: CalendarFeedEntry[] = [];

const toMonthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

const fromMonthIndex = (mi: number) => {
  const year = Math.floor(mi / 12);
  const month = mi % 12; // 0-11
  return { year, month };
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
};

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const nextMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 1);

const FUTURE_BUFFER_MONTHS = 24;
const log = (...args: any[]) => {
  // eslint-disable-next-line no-console
  console.log("[CalendarPage]", ...args);
};

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthActivities, setMonthActivities] = useState<
    Record<string, CalendarActivity[]>
  >({});
  const [monthJournalEntries, setMonthJournalEntries] = useState<
    Record<string, CalendarJournalEntry[]>
  >({});
  const [loadingMonths, setLoadingMonths] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reflectionActivity, setReflectionActivity] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [circleEnabled, setCircleEnabled] = useState(false);
  const [dayThumbs, setDayThumbs] = useState<Record<string, string>>({});
  const [quickLogDate, setQuickLogDate] = useState<string | null>(null);
  const [journalEntryDraftOpen, setJournalEntryDraftOpen] = useState(false);
  const [editingJournalEntry, setEditingJournalEntry] = useState<CalendarJournalEntry | null>(null);
  const [minMonthIndex, setMinMonthIndex] = useState<number | null>(null);
  const [listHeight, setListHeight] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const { unitSystem } = useUnitSystem();
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const scrolledForMinRef = useRef<number | null>(null);
  const apiWasDetachedRef = useRef(false);
  const {
    signedNoteImages,
    signedNoteThumbs,
    noteImageOrientation,
    setNoteImageOrientation,
    resolveFor: resolveNoteImages,
  } = useNoteImages(NOTE_STORAGE_BUCKET);
  const gallery = useGalleryLightbox(NOTE_STORAGE_BUCKET);

  const {
    showAddSheet,
    setShowAddSheet,
    selectedType,
    setSelectedType,
    showQuickLog,
    setShowQuickLog,
    editActivity,
    setEditActivity,
  } = useHomeModals();
  const noteFlow = usePostLogNoteFlow();

  const todayKey = formatDateKey(new Date());
  const todayMonthIndex = toMonthIndex(new Date());

  const buildCalendarCells = useCallback((monthDate: Date) => {
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const firstDay = new Date(Date.UTC(year, monthIndex, 1));
    const startOffsetMonday = (firstDay.getUTCDay() + 6) % 7; // Monday as first day
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const totalCells = 42; // always 6 rows x 7 cols

    return Array.from({ length: totalCells }, (_, idx) => {
      const dayNumber = idx - startOffsetMonday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      const key = `${year}-${`${monthIndex + 1}`.padStart(2, "0")}-${`${dayNumber}`.padStart(2, "0")}`;
      return { key, dayNumber };
    });
  }, []);

  const activitiesByDate = useMemo(() => {
    const grouped: Record<string, CalendarActivity[]> = {};
    Object.values(monthActivities).forEach((list) => {
      list.forEach((activity) => {
        const key =
          typeof activity.date === "string"
            ? activity.date.slice(0, 10)
            : activity.date
            ? formatDateKey(new Date(activity.date))
            : null;
        if (!key) return;
        grouped[key] = grouped[key] ? [...grouped[key], activity] : [activity];
      });
    });
    return grouped;
  }, [monthActivities]);

  const entriesByDate = useMemo(() => {
    const grouped: Record<string, CalendarFeedEntry[]> = {};

    Object.values(monthActivities).forEach((list) => {
      list.forEach((activity) => {
        const key =
          typeof activity.date === "string"
            ? activity.date.slice(0, 10)
            : activity.date
            ? formatDateKey(new Date(activity.date))
            : null;
        if (!key) return;
        const nextActivity = { ...activity, entry_kind: "activity" as const };
        grouped[key] = grouped[key] ? [...grouped[key], nextActivity] : [nextActivity];
      });
    });

    Object.values(monthJournalEntries).forEach((list) => {
      list.forEach((entry) => {
        const key = formatDateKey(new Date(entry.created_at));
        if (!key) return;
        grouped[key] = grouped[key] ? [...grouped[key], entry] : [entry];
      });
    });

    return grouped;
  }, [monthActivities, monthJournalEntries]);

  const selectedDayEntries = useMemo(
    () => (selectedDate ? entriesByDate[selectedDate] || EMPTY_DAY_ENTRIES : EMPTY_DAY_ENTRIES),
    [entriesByDate, selectedDate]
  );

  const fetchMonthActivities = useCallback(
    async (monthDate: Date) => {
      if (!userId) return;
      const key = formatMonthKey(monthDate);
      if (loadingMonths[key]) return;
      if (monthActivities[key] && monthJournalEntries[key]) return;
      setLoadingMonths((prev) => ({ ...prev, [key]: true }));
      try {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = nextMonth(monthDate);
        const [activitiesResult, journalResult] = await Promise.all([
          supabase
            .from("activities")
            .select(
              "id, user_id, type, source, raw_sport_type, raw_type, date, started_at, title, notes, distance_km, duration_min, feeling, effort, note_image_url, note_thumb_image_url, created_at, photos:activity_photos(id, image_path, thumb_path, sort_order, created_at), activity_equipment:activity_equipment(equipment:equipment_id (id, name, notes, is_active))"
            )
            .eq("user_id", userId)
            .gte("date", formatDateKey(monthStart))
            .lt("date", formatDateKey(monthEnd))
            .order("date", { ascending: true })
            .order("created_at", { ascending: true }),
          fetchJournalEntriesInRange(userId, monthStart.toISOString(), monthEnd.toISOString()),
        ]);

        if (activitiesResult.error) {
          setError(activitiesResult.error.message);
          return;
        }

        if (journalResult.error) {
          setError(journalResult.error.message);
          return;
        }

        const mappedActivities =
          activitiesResult.data?.map((activity: any) => {
            const equipment =
              activity.activity_equipment
                ?.map((item: any) => item?.equipment)
                .filter(Boolean) || [];
            return { ...activity, equipment };
          }) || [];

        const mappedJournalEntries =
          journalResult.data?.map((entry) => ({
            ...entry,
            entry_kind: "journal_entry" as const,
            entry_text: entry.text,
            journal_created_at: entry.created_at,
          })) || [];

        setMonthActivities((prev) => ({
          ...prev,
          [key]: mappedActivities,
        }));
        setMonthJournalEntries((prev) => ({
          ...prev,
          [key]: mappedJournalEntries,
        }));
      } finally {
        setLoadingMonths((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [loadingMonths, monthActivities, monthJournalEntries, userId]
  );

  const fetchFirstEntryDate = useCallback(async () => {
    if (!userId) return null;

    const [firstActivityResult, firstJournalResult] = await Promise.all([
      supabase
        .from("activities")
        .select("date")
        .eq("user_id", userId)
        .order("date", { ascending: true })
        .limit(1),
      supabase
        .from("journal_entries")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

    if (firstActivityResult.error) {
      throw firstActivityResult.error;
    }
    if (firstJournalResult.error) {
      throw firstJournalResult.error;
    }

    const candidates = [
      firstActivityResult.data?.[0]?.date ? new Date(firstActivityResult.data[0].date) : null,
      firstJournalResult.data?.[0]?.created_at ? new Date(firstJournalResult.data[0].created_at) : null,
    ].filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())));

    if (candidates.length === 0) return null;

    return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
  }, [userId]);

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
        try {
          const canUseCircle = await hasCircleAccess(user.id);
          setCircleEnabled(canUseCircle);
        } catch {
          setCircleEnabled(false);
        }
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const first = await fetchFirstEntryDate();
        const minIndex = first ? toMonthIndex(first) - 1 : todayMonthIndex - 12;
        log("first entry month index", { first: first?.toISOString?.(), minIndex });
        setMinMonthIndex(minIndex);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load first entry");
      }
    })();
  }, [fetchFirstEntryDate, todayMonthIndex, userId]);

  const openDay = (key: string) => {
    setSelectedDate(key);
  };

  const sortedSelectedEntries = useMemo(() => {
    if (selectedDayEntries.length <= 1) return selectedDayEntries;
    return [...selectedDayEntries].sort((a, b) => {
      const aSource = a.entry_kind === "journal_entry" ? a.created_at : a.started_at || a.created_at || a.date;
      const bSource = b.entry_kind === "journal_entry" ? b.created_at : b.started_at || b.created_at || b.date;
      const aTime = new Date(aSource).getTime();
      const bTime = new Date(bSource).getTime();
      return bTime - aTime;
    });
  }, [selectedDayEntries]);

  const selectedDayActivities = useMemo(
    () =>
      sortedSelectedEntries.filter(
        (item): item is CalendarActivity => item.entry_kind !== "journal_entry"
      ),
    [sortedSelectedEntries]
  );

  const selectedActivityIds = useMemo(
    () => selectedDayActivities.map((item) => String(item.id)),
    [selectedDayActivities]
  );

  const { handleShareWithCircle, sharedWithCircleByActivity, sharingActivityId } =
    useCircleActivitySharing({
      userId,
      circleEnabled,
      activityIds: selectedActivityIds,
      onToast: setToastMessage,
    });

  const openQuickLog = () => {
    setQuickLogDate(selectedDate ?? todayKey);
    setSelectedType(null);
    setShowAddSheet(true);
  };

  const refreshLoadedCalendarData = useCallback(async () => {
    if (!userId) return;
    setMonthActivities({});
    setMonthJournalEntries({});
    setLoadingMonths({});
    setDayThumbs({});
    try {
      const first = await fetchFirstEntryDate();
      const minIndex = first ? toMonthIndex(first) - 1 : todayMonthIndex - 12;
      setMinMonthIndex(minIndex);
    } catch (e: any) {
      setError(e?.message ?? "Failed to refresh calendar");
    }
  }, [fetchFirstEntryDate, todayMonthIndex, userId]);

  const playWritingSound = () => {
    const audio = new Audio("/sounds/writing.mp3");
    audio.play().catch(() => {
      // Ignore autoplay restrictions.
    });
  };

  useEffect(() => {
    if (!selectedDayActivities.length) return;
    const cleanup = resolveNoteImages(selectedDayActivities);
    return cleanup;
  }, [selectedDayActivities, resolveNoteImages]);

  useEffect(() => {
    if (!userId) return;
    const handleStravaSyncComplete = () => {
      void refreshLoadedCalendarData();
    };
    window.addEventListener(STRAVA_SYNC_COMPLETED_EVENT, handleStravaSyncComplete);
    return () => {
      window.removeEventListener(
        STRAVA_SYNC_COMPLETED_EVENT,
        handleStravaSyncComplete
      );
    };
  }, [refreshLoadedCalendarData, userId]);

  useEffect(() => {
    const pickBestPhoto = (day: string, list: CalendarActivity[]) => {
      const candidates = list.filter(
        (a) => a.note_thumb_image_url || a.note_image_url
      );
      if (!candidates.length) return null;
      const maxFeeling = Math.max(
        ...candidates.map((a) => Number(a.feeling) || 0)
      );
      const topFeeling = candidates.filter(
        (a) => (Number(a.feeling) || 0) === maxFeeling
      );
      const maxEffort = Math.max(
        ...topFeeling.map((a) => Number(a.effort) || 0)
      );
      const topEffort =
        maxEffort > 0
          ? topFeeling.filter((a) => (Number(a.effort) || 0) === maxEffort)
          : topFeeling;
      const pool = topEffort.length > 0 ? topEffort : topFeeling;
      const seed = `${day}-thumb`;
      let hash = 0;
      for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      }
      const picked = pool[hash % pool.length];
      return picked.note_thumb_image_url || picked.note_image_url || null;
    };

    let cancelled = false;
    const loadThumbs = async () => {
      const dayToPath: Record<string, string> = {};
      Object.entries(activitiesByDate).forEach(([day, list]) => {
        const path = pickBestPhoto(day, list);
        if (path) dayToPath[day] = path;
      });
      const uniquePaths = Array.from(new Set(Object.values(dayToPath)));
      if (uniquePaths.length === 0) {
        setDayThumbs({});
        return;
      }
      const urlMap = await signStorageValues(uniquePaths, {
        primaryBucket: NOTE_STORAGE_BUCKET,
      });
      if (cancelled) return;
      const next: Record<string, string> = {};
      Object.entries(dayToPath).forEach(([day, path]) => {
        const url = urlMap[path];
        if (url) next[day] = url;
      });
      setDayThumbs(next);
    };

    loadThumbs();
    return () => {
      cancelled = true;
    };
  }, [activitiesByDate]);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const updateHeight = () => {
      setListHeight(el.clientHeight);
    };
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const maxMonthIndex = todayMonthIndex + FUTURE_BUFFER_MONTHS;
  const itemCount =
    minMonthIndex !== null ? maxMonthIndex - minMonthIndex + 1 : 0;

  const resolvedViewportWidth = viewportWidth ?? 1024;
  const listStyle = useMemo(
    () => ({
      height: listHeight ?? 0,
      width: "100%",
      paddingTop: 8,
      paddingBottom: 112,
    }),
    [listHeight]
  );
  const monthRowHeight = useMemo(() => {
    const cellHeight =
      resolvedViewportWidth < 640
        ? 40
        : resolvedViewportWidth < 768
        ? 44
        : 48;
    const gap = 8;
    const rows = 6;
    const gridHeight = rows * cellHeight + (rows - 1) * gap;
    const headerHeight = 40; // title and its margin
    const labelsHeight = 24; // weekday labels row
    const paddingVertical = 24; // section padding (p-3 top+bottom)
    const extra = 8; // small buffer
    return headerHeight + labelsHeight + paddingVertical + gridHeight + extra;
  }, [resolvedViewportWidth]);

  const getDefaultRowIndex = useCallback(() => {
    if (minMonthIndex == null) return 0;
    const defaultMonthIndex = todayMonthIndex - 1; // previous month
    const targetIndex = Math.max(0, defaultMonthIndex - minMonthIndex);
    return Math.min(itemCount - 1, targetIndex);
  }, [itemCount, minMonthIndex, todayMonthIndex]);

  const scrollToDefaultMonth = useCallback(
    (api: ListImperativeAPI) => {
      if (minMonthIndex == null || itemCount === 0) return;
      const idx = getDefaultRowIndex();
      log("scrollToDefaultMonth", { idx, minMonthIndex, itemCount });
      api.scrollToRow({ index: idx, align: "start" });
    },
    [getDefaultRowIndex, itemCount, minMonthIndex]
  );

  const setListApi = useCallback(
    (api: ListImperativeAPI | null) => {
      if (!api) {
        apiWasDetachedRef.current = true;
        log("list API unavailable");
        return;
      }

      const minChanged = scrolledForMinRef.current !== minMonthIndex;
      const reattached = apiWasDetachedRef.current;

      log("list API attached", {
        minChanged,
        reattached,
        minMonthIndex,
        itemCount,
      });

      if (minMonthIndex == null || itemCount === 0) return;

      if (minChanged || reattached) {
        scrollToDefaultMonth(api);
        scrolledForMinRef.current = minMonthIndex;
      }

      apiWasDetachedRef.current = false;
    },
    [itemCount, minMonthIndex, scrollToDefaultMonth]
  );

  const MonthRow = ({ index, style, ariaAttributes }: RowComponentProps) => {
    if (minMonthIndex == null) {
      return <div style={style} {...ariaAttributes} />;
    }

    const monthIndex = minMonthIndex + index;
    const { year, month } = fromMonthIndex(monthIndex);
    const monthDate = new Date(year, month, 1);
    const monthKey = formatMonthKey(monthDate);
    const label = monthDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const calendarCells = buildCalendarCells(monthDate);

    useEffect(() => {
      fetchMonthActivities(monthDate);
    }, [fetchMonthActivities, monthIndex]);

    return (
      <div style={style} className="px-4 mb-2" {...ariaAttributes}>
        <section
          id={`month-${monthKey}`}
          className="max-w-3xl mx-auto rounded-2xl border border-movenotes-border bg-movenotes-surface p-3 shadow-sm h-full"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-movenotes-text">{label}</h2>
            {loadingMonths[monthKey] && (
              <span className="text-xs text-movenotes-muted">Loading…</span>
            )}
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs text-movenotes-muted mb-2">
            {DAY_LABELS.map((dayLabel) => (
              <div key={dayLabel} className="py-1 font-medium tracking-wide">
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 py-2">
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${monthKey}-${idx}`} className="h-10 sm:h-11 md:h-12" />;
              }

              const { key, dayNumber } = cell;
              const entries = entriesByDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              const isFuture = key > todayKey;
              const thumbUrl = dayThumbs[key];
              const hasEntry = entries.length > 0;
              const backgroundClass = thumbUrl
                ? ""
                : isToday
                ? "bg-movenotes-accent text-primary-text"
                : hasEntry
                ? "bg-movenotes-primary text-primary-text"
                : isFuture
                ? "bg-white"
                : "bg-warm-100";
              const dayNumberClass = thumbUrl
                ? "text-primary-text font-semibold"
                : isToday
                ? "text-primary-text font-semibold"
                : hasEntry
                ? "text-primary-text font-semibold"
                : "text-movenotes-text";

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openDay(key)}
                  className={`relative h-10 sm:h-11 md:h-12 w-full rounded-xl border text-center p-1 flex flex-col items-center justify-center gap-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-movenotes-primary overflow-hidden ${
                    hasEntry
                      ? `border-movenotes-border ${backgroundClass} hover:border-movenotes-primary/70`
                      : `border-movenotes-border/80 ${backgroundClass} hover:border-movenotes-primary/60`
                  } ${isSelected ? "ring-2 ring-movenotes-primary/40" : ""}`}
                  style={
                    thumbUrl
                      ? {
                          backgroundImage: `url(${thumbUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  <div className="w-full flex items-center justify-center">
                    <span className={`text-sm ${dayNumberClass}`}>{dayNumber}</span>
                  </div>
                  {isToday && (
                    <span className="absolute top-2 right-2 text-[10px] text-movenotes-muted">
                      •
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="h-screen bg-movenotes-bg flex flex-col overflow-hidden hide-scrollbar">
      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
          {error}
        </div>
      )}

      <div ref={listContainerRef} className="flex-1 overflow-hidden">
        {minMonthIndex !== null && listHeight !== null ? (
          <List
            listRef={setListApi}
            rowCount={itemCount}
            rowHeight={monthRowHeight}
            overscanCount={3}
            className="hide-scrollbar"
            style={listStyle}
            rowComponent={MonthRow}
            rowProps={{}}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-movenotes-muted">
            Loading calendar…
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Add"
        onClick={openQuickLog}
        className="fixed z-40 rounded-full bg-movenotes-primary text-primary-text shadow-lg shadow-movenotes-primary/30 active:scale-95 transition flex items-center justify-center gap-2 text-lg px-4 h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-movenotes-primary"
        style={{
          right: "calc(16px + env(safe-area-inset-right))",
          bottom: "calc(90px + env(safe-area-inset-bottom))",
        }}
      >
        <span className="text-2xl leading-none">+</span>
        <span className="text-sm font-semibold">Add</span>
      </button>

      {selectedDate && (
        <ModalSheet onClose={() => setSelectedDate(null)}>
          <div className="text-center mb-4">
            <p className="text-sm uppercase tracking-wide text-movenotes-primary font-semibold mb-1">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
            <h3 className="text-xl font-semibold text-movenotes-text">Day entries</h3>
          </div>

          {sortedSelectedEntries.length === 0 ? (
            <p className="text-center text-movenotes-muted">No entries for this day.</p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto pb-2 flex flex-col gap-3 -mx-2 px-1">
              {sortedSelectedEntries.map((entry) => {
                if (entry.entry_kind === "journal_entry") {
                  return (
                    <JournalEntryCard
                      key={`journal-${entry.id}`}
                      entry={entry}
                      onClick={
                        entry.entry_type === "journal_note"
                          ? () => setEditingJournalEntry(entry)
                          : undefined
                      }
                    />
                  );
                }

                return (
                  <RecentActivityCard
                    key={entry.id}
                    activity={entry}
                    signedNoteImages={signedNoteImages}
                    signedNoteThumbs={signedNoteThumbs}
                    noteImageOrientation={noteImageOrientation}
                    onEdit={(activity) => setEditActivity(activity)}
                    onNoteImageLoad={(activityId, naturalWidth, naturalHeight) => {
                      setNoteImageOrientation((prev) => ({
                        ...prev,
                        [activityId]:
                          naturalHeight > naturalWidth ? "portrait" : "landscape",
                      }));
                    }}
                    unitSystem={unitSystem}
                    tooltipVisible={false}
                    onTooltipClose={() => {}}
                    onOpenGallery={(activity) => {
                      const items = buildGalleryItemsForActivity(activity);
                      gallery.openGallery(items, 0);
                    }}
                    onAddReflection={(activity) => setReflectionActivity(activity)}
                    canShareWithCircle={circleEnabled}
                    onShareWithCircle={handleShareWithCircle}
                    sharedWithCircle={Boolean(sharedWithCircleByActivity[entry.id])}
                    sharingWithCircle={sharingActivityId === entry.id}
                    disableSwipe={gallery.open}
                  />
                );
              })}
            </div>
          )}
        </ModalSheet>
      )}

      {selectedDate && (
        <button
          type="button"
          aria-label="Add for this day"
          onClick={() => {
            setQuickLogDate(selectedDate ?? todayKey);
            setSelectedType(null);
            setShowAddSheet(true);
          }}
          className="fixed z-[70] rounded-full bg-movenotes-primary text-primary-text shadow-lg shadow-movenotes-primary/30 active:scale-95 transition flex items-center justify-center gap-2 text-lg px-4 h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-movenotes-primary"
          style={{
            right: "calc(16px + env(safe-area-inset-right))",
            bottom: "calc(90px + env(safe-area-inset-bottom))",
          }}
        >
          <span className="text-2xl leading-none">+</span>
          <span className="text-sm font-semibold">Add</span>
        </button>
      )}

      <GalleryLightbox
        open={gallery.open}
        items={gallery.items}
        activeIndex={gallery.activeIndex}
        onActiveIndexChange={gallery.setActiveIndex}
        onClose={gallery.closeGallery}
        signedImages={gallery.signedImages}
        signedThumbs={gallery.signedThumbs}
      />

      <AddBottomSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSelectJournalEntry={() => {
          setShowAddSheet(false);
          setJournalEntryDraftOpen(true);
        }}
        onSelectActivity={(typeId) => {
          setSelectedType(typeId);
          setShowAddSheet(false);
          setShowQuickLog(true);
        }}
      />

      <JournalEntryModal
        open={journalEntryDraftOpen || Boolean(editingJournalEntry)}
        entry={editingJournalEntry}
        onClose={() => {
          setJournalEntryDraftOpen(false);
          setEditingJournalEntry(null);
        }}
        onSaved={() => {
          setJournalEntryDraftOpen(false);
          setEditingJournalEntry(null);
          setToastMessage("Journal entry saved");
          void refreshLoadedCalendarData();
        }}
        onDeleted={() => {
          setJournalEntryDraftOpen(false);
          setEditingJournalEntry(null);
          setToastMessage("Journal entry deleted");
          void refreshLoadedCalendarData();
        }}
      />

      {showQuickLog && (
        <AddActivityModal
          initialType={selectedType ?? "run"}
          initialDate={quickLogDate ?? selectedDate ?? todayKey}
          returnTo="/calendar"
          onClose={() => {
            setShowQuickLog(false);
            setQuickLogDate(null);
          }}
          onLogged={async (activityId) => {
            noteFlow.handleLogged(activityId);
            await refreshLoadedCalendarData();
          }}
        />
      )}

      {editActivity && (
        <EditActivityModal
          activity={editActivity}
          onClose={() => setEditActivity(null)}
          onUpdated={() => {
            setEditActivity(null);
            void refreshLoadedCalendarData();
          }}
          onDeleted={() => {
            setEditActivity(null);
            void refreshLoadedCalendarData();
          }}
          zIndexClass="z-[60]"
        />
      )}

      {reflectionActivity && (
        <EditActivityModal
          activity={reflectionActivity}
          reflectionOnly
          onClose={() => setReflectionActivity(null)}
          onUpdated={() => {
            setReflectionActivity(null);
            setToastMessage("Reflection saved ✍️");
            playWritingSound();
            void refreshLoadedCalendarData();
          }}
          onDeleted={() => {
            setReflectionActivity(null);
          }}
          zIndexClass="z-[60]"
        />
      )}

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      <PostLogNoteFlow
        flow={noteFlow}
        onRefreshAfterNote={() => void refreshLoadedCalendarData()}
      />
    </div>
  );
}
