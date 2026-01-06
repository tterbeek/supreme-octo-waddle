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
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useUnitSystem } from "../contexts/UnitContext";
import { formatDistance } from "../lib/units";
import { getCurrentUser } from "../services/auth.service";
import { restoreActivity } from "../services/activities.service";
import { useHomeFeed } from "../hooks/useHomeFeed";
import { useNoteImages } from "../hooks/useNoteImages";
import { useLightbox } from "../hooks/useLightbox";
import { usePostLogNoteFlow } from "../hooks/usePostLogNoteFlow";
import { useHomeModals } from "../hooks/useHomeModals";

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
  const {
    lightbox,
    closeLightbox,
    handleOverlayClick: handleLightboxOverlayClick,
    onImageClick: onLightboxImageClick,
    onImageTouchStart: onLightboxImageTouchStart,
    onImageTouchMove: onLightboxImageTouchMove,
    onImageTouchEnd: onLightboxImageTouchEnd,
  } = useLightbox();

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

  const hasDoneOnboarding =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";
  const showFirstLogPrompt = initialFeedLoaded && activities.length === 0;

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

    filteredActivities.forEach((a) => {
      const iso = typeof a.date === "string" ? a.date : a.date ? new Date(a.date).toISOString() : "";
      if (!iso) return;
      const dayKey = iso.slice(0, 10);
      const monthKey = iso.slice(0, 7); // YYYY-MM
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
                  {month.days.map((day) => (
                    <div key={day.key} className="flex gap-1 items-start">
                      <div className="w-8 sm:w-9 md:w-10 flex-shrink-0 text-left text-movenotes-muted uppercase text-xs font-semibold leading-5 pt-1 ml-[-6px]">
                        <div>{day.weekday}</div>
                        <div className="text-base text-movenotes-text">{day.dayNumber}</div>
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        {day.items.map((a) => {
                          const showAfterLogTooltip = visible === "after_first_log" && renderIndex === 0;
                          const card = (
                            <RecentActivityCard
                              key={a.id}
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
                              onImageClick={onLightboxImageClick}
                              onImageTouchStart={onLightboxImageTouchStart}
                              onImageTouchMove={onLightboxImageTouchMove}
                              onImageTouchEnd={onLightboxImageTouchEnd}
                              disableSwipe={!!lightbox}
                            />
                          );
                          renderIndex += 1;
                          return card;
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
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
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
              {lightbox.activity?.distance_km && (
                <span className="mx-2">•</span>
              )}
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
              {lightbox.activity?.type && (
                <span className="mx-2">•</span>
              )}
              {lightbox.activity?.type && (
                <span className="uppercase">{lightbox.activity.type}</span>
              )}
            </div>
          </div>
        )}

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
