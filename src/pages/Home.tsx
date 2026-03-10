// src/pages/Home.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import AddActivityModal from "../features/activities/AddActivityModal";
import { SelectActivityTypeModal } from "../components/SelectActivityTypeModal";
import Toast from "../components/Toast";
import EditActivityModal from "../features/activities/EditActivityModal";
import RecentActivityCard from "../components/RecentActivityCard";
import SearchBar from "../components/SearchBar";
import LogCTA from "../components/LogCTA";
import PostLogNoteFlow from "../components/PostLogNoteFlow";
import TinyTweakStrip from "../components/TinyTweakStrip";
import JournalEntryCard from "../components/JournalEntryCard";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useUnitSystem } from "../contexts/UnitContext";
import { getCurrentUser } from "../services/auth.service";
import { restoreActivity } from "../services/activities.service";
import { useHomeFeed } from "../hooks/useHomeFeed";
import { useNoteImages } from "../hooks/useNoteImages";
import GalleryLightbox from "../components/GalleryLightbox";
import { useGalleryLightbox } from "../hooks/useGalleryLightbox";
import { buildGalleryItemsForActivity } from "../lib/photos";
import { usePostLogNoteFlow } from "../hooks/usePostLogNoteFlow";
import { useHomeModals } from "../hooks/useHomeModals";
import { STRAVA_SYNC_COMPLETED_EVENT } from "../services/strava.service";
import {
  fetchOwnSharedActivityIds,
  hasCircleAccess,
  shareActivityWithConnections,
  unshareActivity,
} from "../services/circle.service";

const NOTE_BUCKET = "actvity-notes"; // adjust if bucket name changes

export default function Home() {
  const { unitSystem } = useUnitSystem();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------
  const [userId, setUserId] = useState<string | null>(null);

  const {
    signedNoteImages,
    signedNoteThumbs,
    noteImageOrientation,
    setNoteImageOrientation,
    resolveFor: resolveNoteImages,
  } = useNoteImages(NOTE_BUCKET);
  const { visible, hideTooltip, showTooltip } = useTooltipManager();
  const gallery = useGalleryLightbox(NOTE_BUCKET);

  // Quick log / edit modals
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

  // Toasts
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reflectionActivity, setReflectionActivity] = useState<any | null>(null);
  const [circleEnabled, setCircleEnabled] = useState(false);
  const [sharingActivityId, setSharingActivityId] = useState<string | null>(null);
  const [sharedWithCircleByActivity, setSharedWithCircleByActivity] = useState<
    Record<string, boolean>
  >({});
  const noteFlow = usePostLogNoteFlow();

  // Sidebar
  // Delete / undo
  const lastDeletedRef = useRef<any | null>(null);

  // Infinite scroll feed
  const {
    activities,
    filteredActivities,
    refresh: refreshFeed,
    initialFeedLoaded,
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
  } = useHomeFeed(userId);
  useEffect(() => {
    const logoEl = document.getElementById("layout-header-logo");
    if (!logoEl) return;
    logoEl.style.transition = "opacity 200ms ease";
    logoEl.style.opacity = searchOpen ? "0" : "1";
    logoEl.style.pointerEvents = searchOpen ? "none" : "auto";
  }, [searchOpen]);
  const toggleSearch = () => {
    if (searchOpen) {
      setSearchTerm("");
    }
    setSearchOpen(!searchOpen);
  };

  const openQuickLog = () => {
    hideTooltip();
    setSelectedType(null);
    setShowTypeSelector(true);
  };

  async function refreshActivities() {
    if (!userId) return;

    await refreshFeed();
  }


  // --------------------------------------------------
  // INITIAL LOAD: user → feed
  // --------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        setUserId(user.id);
        try {
          const canUseCircle = await hasCircleAccess(user.id);
          setCircleEnabled(canUseCircle);
        } catch {
          setCircleEnabled(false);
        }

        await refreshFeed();
      } finally {
        // no-op
      }
    };

    load();
  }, []);

  // --------------------------------------------------
  // SIGNED URLS FOR NOTE IMAGES (feeds)
  // --------------------------------------------------
  useEffect(() => {
    const cleanup = resolveNoteImages(activities);
    return cleanup;
  }, [activities, resolveNoteImages]);

  useEffect(() => {
    if (!userId) return;
    const handleStravaSyncComplete = () => {
      void refreshFeed();
    };
    window.addEventListener(STRAVA_SYNC_COMPLETED_EVENT, handleStravaSyncComplete);
    return () => {
      window.removeEventListener(
        STRAVA_SYNC_COMPLETED_EVENT,
        handleStravaSyncComplete
      );
    };
  }, [refreshFeed, userId]);

  const hasDoneOnboarding =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";
  const showFirstLogPrompt = initialFeedLoaded && activities.length === 0;

  useEffect(() => {
    if (!hasDoneOnboarding || !initialFeedLoaded) return;
    if (activities.length >= 3) {
      showTooltip("tiny_tweak_prompt");
    }
  }, [activities.length, hasDoneOnboarding, initialFeedLoaded, showTooltip]);

  // --------------------------------------------------
  // DELETE / UNDO
  // --------------------------------------------------

  const undoDelete = async () => {
    if (!lastDeletedRef.current) return;
    const { error } = await restoreActivity(lastDeletedRef.current);
    if (error) {
      console.error("[Home] Undo delete failed:", error.message);
      return;
    }
    lastDeletedRef.current = null;
    setShowUndoToast(false);
    refreshActivities();
  };

  const playWritingSound = () => {
    const audio = new Audio("/sounds/writing.mp3");
    audio.play().catch(() => {
      // Ignore autoplay restrictions.
    });
  };

  const handleShareWithCircle = async (activity: any) => {
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
        setToastMessage("Removed from Circle");
      } else {
        await shareActivityWithConnections(activity.id, userId);
        setSharedWithCircleByActivity((prev) => ({ ...prev, [activity.id]: true }));
        setToastMessage("Shared with Circle");
      }
    } catch (err: any) {
      setToastMessage(err?.message || "Could not share with Circle.");
    } finally {
      setSharingActivityId(null);
    }
  };

  useEffect(() => {
    if (!userId || !circleEnabled) {
      setSharedWithCircleByActivity({});
      return;
    }

    const activityIds = activities
      .filter((item) => item?.entry_kind !== "journal_entry")
      .map((item) => String(item.id));
    if (!activityIds.length) {
      setSharedWithCircleByActivity({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const sharedIds = await fetchOwnSharedActivityIds(userId, activityIds);
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        sharedIds.forEach((id) => {
          next[id] = true;
        });
        setSharedWithCircleByActivity(next);
      } catch {
        if (!cancelled) setSharedWithCircleByActivity({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activities, circleEnabled, userId]);

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  const monthGroups = useMemo(() => {
    type DayGroup = {
      key: string;
      weekday: string;
      dayNumber: string;
      items: typeof filteredActivities;
    };
    type MonthGroup = {
      key: string;
      label: string;
      days: DayGroup[];
    };

    const months: MonthGroup[] = [];
    const monthMap = new Map<string, MonthGroup>();

    const toDayKey = (value: any) => {
      if (!value) return "";
      if (typeof value === "string" && value.length >= 10) {
        return value.slice(0, 10);
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 10);
    };

    const getEntryDayKey = (entry: any) => {
      if (entry.day) return toDayKey(entry.day);
      if (entry.date) return toDayKey(entry.date);
      if (entry.journal_created_at) return toDayKey(entry.journal_created_at);
      return "";
    };

    filteredActivities.forEach((a) => {
      const dayKey = getEntryDayKey(a);
      if (!dayKey) return;
      const monthKey = dayKey.slice(0, 7); // YYYY-MM
      const dateObj = new Date(dayKey);

      let monthBucket = monthMap.get(monthKey);
      if (!monthBucket) {
        const monthLabel = dateObj.toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        });
        monthBucket = { key: monthKey, label: monthLabel, days: [] };
        monthMap.set(monthKey, monthBucket);
        months.push(monthBucket);
      }

      let dayBucket = monthBucket.days.find((d) => d.key === dayKey);
      if (!dayBucket) {
        dayBucket = {
          key: dayKey,
          weekday: dateObj.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
          dayNumber: dateObj.toLocaleDateString("en-GB", { day: "2-digit" }),
          items: [],
        };
        monthBucket.days.push(dayBucket);
      }

      dayBucket.items.push(a);
    });

    return months;
  }, [filteredActivities]);

  return (
    <div className="min-h-screen bg-movenotes-bg p-1">
      <div className="mt-2">

        {/* -------------------------------------------------- */}
        {/* RECENT HISTORY                                     */}
        {/* -------------------------------------------------- */}
        <SearchBar
          searchOpen={searchOpen}
          searchTerm={searchTerm}
          setSearchOpen={setSearchOpen}
          setSearchTerm={setSearchTerm}
          onToggle={toggleSearch}
          alignCenterOnOpen
          className="z-50 px-0"
          portalTargetId="layout-top-right-slot"
          centerPortalTargetId="layout-search-layer"
        />

        <div className="flex flex-col gap-8">
          {showFirstLogPrompt && (
            <LogCTA
              showFirstLogPrompt={showFirstLogPrompt}
            />
          )}

          {monthGroups.map((month, idx) => {
            let renderIndex = 0;
            const isFirstMonth = idx === 0;
            return (
              <div key={month.key} className="flex flex-col gap-3 -ml-2">
                <h3
                  className={`${
                    isFirstMonth ? "mt-1" : "mt-4"
                  } mb-1 text-sm md:text-base font-medium text-movenotes-text/60 ml-[-6px]`}
                >
                  {month.label}
                </h3>
                <div className="flex flex-col gap-5">
                  {isFirstMonth && (
                    <div className="flex gap-1 items-start">
                      <div
                        aria-hidden="true"
                        className="w-8 sm:w-9 md:w-10 flex-shrink-0 ml-[-6px]"
                      />
                      <div className="flex-1">
                        <TinyTweakStrip
                          userId={userId}
                          tooltipVisible={visible === "tiny_tweak_prompt"}
                          onTooltipClose={hideTooltip}
                        />
                      </div>
                    </div>
                  )}
                  {month.days.map((day) => (
                    <div key={day.key} className="flex gap-1 items-start">
                      <div className="w-8 sm:w-9 md:w-10 flex-shrink-0 text-left text-movenotes-muted uppercase text-xs font-semibold leading-5 pt-1 ml-[-6px]">
                        <div>{day.weekday}</div>
                        <div className="text-base text-movenotes-text">{day.dayNumber}</div>
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        {day.items.map((a) => {
                          if (a.entry_kind === "journal_entry") {
                            return (
                              <JournalEntryCard
                                key={`journal-${a.id}`}
                                entry={a}
                              />
                            );
                          }

                          const showAfterLogTooltip =
                            visible === "after_first_log" && renderIndex === 0;
                          renderIndex += 1;
                          return (
                            <RecentActivityCard
                              key={`activity-${a.id}`}
                              activity={a}
                              signedNoteImages={signedNoteImages}
                              signedNoteThumbs={signedNoteThumbs}
                              noteImageOrientation={noteImageOrientation}
                              onEdit={(activity) => {
                                hideTooltip();
                                setEditActivity(activity);
                              }}
                              onNoteImageLoad={(activityId, naturalWidth, naturalHeight) => {
                                setNoteImageOrientation((prev) => ({
                                  ...prev,
                                  [activityId]:
                                    naturalHeight > naturalWidth ? "portrait" : "landscape",
                                }));
                              }}
                              unitSystem={unitSystem}
                              tooltipVisible={showAfterLogTooltip}
                              onTooltipClose={hideTooltip}
                              onOpenGallery={(activity) => {
                                const items = buildGalleryItemsForActivity(activity);
                                gallery.openGallery(items, 0);
                              }}
                              onAddReflection={(activity) => setReflectionActivity(activity)}
                              canShareWithCircle={circleEnabled}
                              onShareWithCircle={handleShareWithCircle}
                              sharedWithCircle={Boolean(sharedWithCircleByActivity[a.id])}
                              sharingWithCircle={sharingActivityId === a.id}
                              disableSwipe={gallery.open}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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

        {/* -------------------------------------------------- */}
        {/* MODALS & TOASTS                                    */}
        {/* -------------------------------------------------- */}
        <SelectActivityTypeModal
          open={showTypeSelector}
          onClose={() => setShowTypeSelector(false)}
          onSelect={(typeId) => {
            setSelectedType(typeId);
            setShowTypeSelector(false);
            setShowQuickLog(true);
          }}
        />

        <GalleryLightbox
          open={gallery.open}
          items={gallery.items}
          activeIndex={gallery.activeIndex}
          onActiveIndexChange={gallery.setActiveIndex}
          onClose={gallery.closeGallery}
          signedImages={gallery.signedImages}
          signedThumbs={gallery.signedThumbs}
        />

        {showQuickLog && (
          <AddActivityModal
            initialType={selectedType ?? "run"}
            onClose={() => {
              setShowQuickLog(false);
            }}
            onLogged={async (activityId) => {
              if (hasDoneOnboarding) {
                showTooltip("after_first_log");
              }
              noteFlow.handleLogged(activityId);
              await refreshActivities();
            }}
          />
        )}

        {editActivity && (
          <EditActivityModal
            activity={editActivity}
            onClose={() => setEditActivity(null)}
            onUpdated={() => {
              setToastMessage("Activity updated ✅");
              setEditActivity(null);
              refreshActivities();
            }}
            onDeleted={() => {
              setToastMessage("Activity deleted 🗑️");
              setEditActivity(null);
              refreshActivities();
            }}
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
              refreshActivities();
            }}
            onDeleted={() => {
              setReflectionActivity(null);
            }}
          />
        )}

        {toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )}

        <PostLogNoteFlow flow={noteFlow} onRefreshAfterNote={refreshActivities} />

        {showUndoToast && (
          <Toast
            message={
              <>
                Activity deleted —
                <button onClick={undoDelete} className="underline ml-1">
                  Undo
                </button>
              </>
            }
            onClose={() => {
              setShowUndoToast(false);
              lastDeletedRef.current = null;
            }}
          />
        )}

      </div>
    </div>
  );
}
