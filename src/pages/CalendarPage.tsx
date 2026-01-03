import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import ModalSheet from "../components/ModalSheet";
import { SelectActivityTypeModal } from "../components/SelectActivityTypeModal";
import AddActivityModal from "../features/activities/AddActivityModal";
import EditActivityModal from "../features/activities/EditActivityModal";
import { useHomeModals } from "../hooks/useHomeModals";
import { getCurrentUser } from "../services/auth.service";
import { useUnitSystem } from "../contexts/UnitContext";
import { formatDistance } from "../lib/units";
import RecentActivityCard from "../components/RecentActivityCard";
import { useNoteImages } from "../hooks/useNoteImages";
import { useLightbox } from "../hooks/useLightbox";
import { createSignedUrls } from "../services/storage.service";

type CalendarActivity = {
  id: string;
  date: string;
  type: string;
  title?: string | null;
  notes?: string | null;
  distance_km?: number | null;
  duration_min?: number | null;
  effort?: number | null;
  feeling?: number | null;
  created_at?: string | null;
  note_image_url?: string | null;
  note_thumb_image_url?: string | null;
  equipment?: Array<{
    id: string;
    name: string;
    notes?: string | null;
    is_active?: boolean | null;
  }>;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const NOTE_BUCKET = "actvity-notes";
const EMPTY_DAY_ACTIVITIES: CalendarActivity[] = [];

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

const addMonths = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthActivities, setMonthActivities] = useState<
    Record<string, CalendarActivity[]>
  >({});
  const [loadingMonths, setLoadingMonths] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayThumbs, setDayThumbs] = useState<Record<string, string>>({});
  const [startOffset, setStartOffset] = useState(-2);
  const [endOffset, setEndOffset] = useState(2);
  const { unitSystem } = useUnitSystem();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrolledToTodayRef = useRef(false);
  const {
    signedNoteImages,
    signedNoteThumbs,
    noteImageOrientation,
    setNoteImageOrientation,
    resolveFor: resolveNoteImages,
  } = useNoteImages(NOTE_BUCKET);
  const {
    lightbox,
    closeLightbox,
    handleOverlayClick: handleLightboxOverlayClick,
    onImageClick: onLightboxImageClick,
    onImageTouchStart: onLightboxImageTouchStart,
    onImageTouchMove: onLightboxImageTouchMove,
    onImageTouchEnd: onLightboxImageTouchEnd,
  } = useLightbox();

  const {
    showTypeSelector,
    setShowTypeSelector,
    selectedType,
    setSelectedType,
    showQuickLog,
    setShowQuickLog,
    editActivity,
    setEditActivity,
  } = useHomeModals();

  const today = startOfMonth(new Date());
  const todayKey = formatDateKey(new Date());
  const todayMonthKey = formatMonthKey(today);

  const visibleMonths = useMemo(() => {
    const months: Date[] = [];
    for (let i = startOffset; i <= endOffset; i += 1) {
      months.push(startOfMonth(addMonths(today, i)));
    }
    return months;
  }, [endOffset, startOffset, today]);

  const buildCalendarCells = useCallback((monthDate: Date) => {
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const firstDay = new Date(Date.UTC(year, monthIndex, 1));
    const startOffsetMonday = (firstDay.getUTCDay() + 6) % 7; // Monday as first day
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const totalCells = Math.ceil((startOffsetMonday + daysInMonth) / 7) * 7;

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

  const selectedDayActivities = useMemo(
    () => (selectedDate ? activitiesByDate[selectedDate] || EMPTY_DAY_ACTIVITIES : EMPTY_DAY_ACTIVITIES),
    [activitiesByDate, selectedDate]
  );

  const fetchMonthActivities = useCallback(
    async (monthDate: Date) => {
      if (!userId) return;
      const key = formatMonthKey(monthDate);
      if (loadingMonths[key]) return;
      if (monthActivities[key]) return;
      setLoadingMonths((prev) => ({ ...prev, [key]: true }));
      try {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = nextMonth(monthDate);
        const { data, error: monthError } = await supabase
          .from("activities")
          .select(
            "id, user_id, type, date, title, notes, distance_km, duration_min, feeling, effort, note_image_url, note_thumb_image_url, created_at, activity_equipment:activity_equipment(equipment:equipment_id (id, name, notes, is_active))"
          )
          .eq("user_id", userId)
          .gte("date", formatDateKey(monthStart))
          .lt("date", formatDateKey(monthEnd))
          .order("date", { ascending: true })
          .order("created_at", { ascending: true });

        if (monthError) {
          setError(monthError.message);
          return;
        }

        const mapped =
          data?.map((activity: any) => {
            const equipment =
              activity.activity_equipment
                ?.map((item: any) => item?.equipment)
                .filter(Boolean) || [];
            return { ...activity, equipment };
          }) || [];

        setMonthActivities((prev) => ({
          ...prev,
          [key]: mapped,
        }));
      } finally {
        setLoadingMonths((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [loadingMonths, monthActivities, userId]
  );

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    visibleMonths.forEach((monthDate) => {
      fetchMonthActivities(monthDate);
    });
  }, [fetchMonthActivities, userId, visibleMonths]);

  const openDay = (key: string) => {
    setSelectedDate(key);
  };

  const sortedSelectedActivities = useMemo(() => {
    if (selectedDayActivities.length <= 1) return selectedDayActivities;
    return [...selectedDayActivities].sort((a, b) => {
      const aTime = new Date(a.created_at || a.date).getTime();
      const bTime = new Date(b.created_at || b.date).getTime();
      return bTime - aTime;
    });
  }, [selectedDayActivities]);

  const openQuickLog = () => {
    setSelectedType(null);
    setShowTypeSelector(true);
  };

  useEffect(() => {
    if (!sortedSelectedActivities.length) return;
    const cleanup = resolveNoteImages(sortedSelectedActivities);
    return cleanup;
  }, [sortedSelectedActivities, resolveNoteImages]);

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
      const urlMap = await createSignedUrls(NOTE_BUCKET, uniquePaths);
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
    if (scrolledToTodayRef.current) return;
    const container = scrollRef.current;
    const target = document.getElementById(`month-${todayMonthKey}`);
    if (!container || !target) return;
    const offsetTop = target.offsetTop;
    const alignBottomOffset =
      offsetTop - (container.clientHeight - target.offsetHeight) + 12;
    const offset = Math.max(0, alignBottomOffset);
    container.scrollTo({ top: offset });
    scrolledToTodayRef.current = true;
  }, [todayMonthKey, visibleMonths]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop < 180 && startOffset > -12) {
      setStartOffset((prev) => prev - 1);
    }
    if (scrollTop + clientHeight > scrollHeight - 180 && endOffset < 12) {
      setEndOffset((prev) => prev + 1);
    }
  };

  return (
    <div className="h-screen bg-movenotes-bg flex flex-col">
      <div className="px-4 pt-3 pb-2">
        <h1 className="text-xl font-semibold text-movenotes-text">Calendar</h1>
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pb-28"
      >
        <div className="max-w-3xl mx-auto space-y-8">
          {visibleMonths.map((monthDate) => {
            const label = monthDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            });
            const monthKey = formatMonthKey(monthDate);
            const calendarCells = buildCalendarCells(monthDate);
            return (
              <section key={monthKey} id={`month-${monthKey}`} className="rounded-2xl border border-movenotes-border bg-movenotes-surface p-3 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-movenotes-text">{label}</h2>
                  {loadingMonths[monthKey] && (
                    <span className="text-xs text-movenotes-muted">Loading…</span>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs text-movenotes-muted mb-2">
                  {DAY_LABELS.map((label) => (
                    <div key={label} className="py-1 font-medium tracking-wide">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${monthKey}-${idx}`} className="aspect-square" />;
                    }

                    const { key, dayNumber } = cell;
                    const entries = activitiesByDate[key] || [];
                    const isToday = key === todayKey;
                    const isSelected = key === selectedDate;
                    const isFuture = key > todayKey;
                    const thumbUrl = dayThumbs[key];
                    const hasActivity = entries.length > 0;
                    const backgroundClass = thumbUrl
                      ? ""
                      : hasActivity
                      ? "bg-movenotes-primary text-primary-text"
                      : isFuture
                      ? "bg-white"
                      : "bg-warm-100";
                    const dayNumberClass = thumbUrl
                      ? "text-primary-text font-semibold"
                      : hasActivity
                      ? "text-primary-text font-semibold"
                      : isToday
                      ? "text-movenotes-primary font-semibold"
                      : "text-movenotes-text";

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openDay(key)}
                        className={`relative aspect-square rounded-xl border text-left p-2 flex flex-col items-center justify-center gap-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-movenotes-primary overflow-hidden ${
                          entries.length > 0
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
                        <div className="flex items-start justify-between w-full">
                          <span className={`text-sm ${dayNumberClass}`}>
                            {dayNumber}
                          </span>
                          {isToday && (
                            <span className="text-[10px] text-movenotes-muted">•</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label="Add activity"
        onClick={openQuickLog}
        className="fixed z-40 rounded-full bg-movenotes-primary text-primary-text shadow-lg shadow-movenotes-primary/30 active:scale-95 transition flex items-center justify-center gap-2 text-lg px-4 h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-movenotes-primary"
        style={{
          right: "calc(16px + env(safe-area-inset-right))",
          bottom: "calc(90px + env(safe-area-inset-bottom))",
        }}
      >
        <span className="text-2xl leading-none">+</span>
        <span className="text-sm font-semibold">Add activity</span>
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

          {sortedSelectedActivities.length === 0 ? (
            <p className="text-center text-movenotes-muted">No entries for this day.</p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto pb-2 flex flex-col gap-3 -mx-2 px-1">
              {sortedSelectedActivities.map((activity) => (
                <RecentActivityCard
                  key={activity.id}
                  activity={activity}
                  signedNoteImages={signedNoteImages}
                  signedNoteThumbs={signedNoteThumbs}
                  noteImageOrientation={noteImageOrientation}
                  onEdit={(a) => setEditActivity(a)}
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
                  onImageClick={(e, url, act) => onLightboxImageClick(e, url, act)}
                  onImageTouchStart={onLightboxImageTouchStart}
                  onImageTouchMove={onLightboxImageTouchMove}
                  onImageTouchEnd={(e, url, act) => onLightboxImageTouchEnd(e, url, act)}
                  disableSwipe
                />
              ))}
            </div>
          )}
        </ModalSheet>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
          onClick={handleLightboxOverlayClick}
        >
          <button
            aria-label="Close"
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
          >
            ×
          </button>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="relative flex items-center justify-center max-w-5xl w-full max-h-[85vh]">
              <div className="absolute inset-4 rounded-3xl pointer-events-none shadow-md shadow-[rgba(0,0,0,0.15)]" />
              <img
                src={lightbox.url}
                alt="Activity note full size"
                className="relative max-h-[85vh] max-w-[90vw] w-auto h-auto object-contain rounded-3xl"
              />
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.18) 100%)",
                }}
              />
            </div>
          </div>
          <div className="pb-6 px-6 text-center text-sm text-white/80">
            {lightbox.activity?.date && (
              <span>
                {new Date(lightbox.activity.date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {lightbox.activity?.distance_km && <span className="mx-2">•</span>}
            {lightbox.activity?.distance_km && (
              <span>
                {formatDistance(Number(lightbox.activity.distance_km), unitSystem)}
              </span>
            )}
            {lightbox.activity?.duration_min && (
              <>
                <span className="mx-2">•</span>
                <span>{Number(lightbox.activity.duration_min)} min</span>
              </>
            )}
            {lightbox.activity?.type && <span className="mx-2">•</span>}
            {lightbox.activity?.type && (
              <span className="uppercase">{lightbox.activity.type}</span>
            )}
          </div>
        </div>
      )}

      <SelectActivityTypeModal
        open={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelect={(typeId) => {
          setSelectedType(typeId);
          setShowTypeSelector(false);
          setShowQuickLog(true);
        }}
      />

      {showQuickLog && (
        <AddActivityModal
          initialType={selectedType ?? "run"}
          initialDate={selectedDate ?? todayKey}
          returnTo="/calendar"
          onClose={() => setShowQuickLog(false)}
          onLogged={async (_id) => {
            await fetchMonthActivities(today);
          }}
        />
      )}

      {editActivity && (
        <EditActivityModal
          activity={editActivity}
          onClose={() => setEditActivity(null)}
          onUpdated={() => {
            setEditActivity(null);
            fetchMonthActivities(today);
          }}
          onDeleted={() => {
            setEditActivity(null);
            fetchMonthActivities(today);
          }}
          zIndexClass="z-[60]"
        />
      )}
    </div>
  );
}
