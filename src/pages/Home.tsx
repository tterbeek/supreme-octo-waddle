// src/pages/Home.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import AddActivityModal from "../features/activities/AddActivityModal";
import AddBottomSheet from "../components/AddBottomSheet";
import Toast from "../components/Toast";
import AddNoteModal from "../components/AddNoteModal";
import EditActivityModal from "../features/activities/EditActivityModal";
import RecentActivityCard from "../components/RecentActivityCard";
import SearchBar from "../components/SearchBar";
import LogCTA from "../components/LogCTA";
import PostLogNoteFlow from "../components/PostLogNoteFlow";
import TinyTweakStrip from "../components/TinyTweakStrip";
import JournalEntryCard from "../components/JournalEntryCard";
import JournalEntryModal from "../components/JournalEntryModal";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useUnitSystem } from "../contexts/UnitContext";
import { getCurrentUser } from "../services/auth.service";
import {
  restoreActivity,
  updateActivityEffort,
  updateActivityFeeling,
} from "../services/activities.service";
import { useHomeFeed } from "../hooks/useHomeFeed";
import { useNoteImages } from "../hooks/useNoteImages";
import GalleryLightbox from "../components/GalleryLightbox";
import { useGalleryLightbox } from "../hooks/useGalleryLightbox";
import { buildGalleryItemsForActivity } from "../lib/photos";
import { usePostLogNoteFlow } from "../hooks/usePostLogNoteFlow";
import { useHomeModals } from "../hooks/useHomeModals";
import { STRAVA_SYNC_COMPLETED_EVENT } from "../services/strava.service";
import { useCircleActivitySharing } from "../hooks/useCircleActivitySharing";
import { NOTE_STORAGE_BUCKET } from "../services/storage.service";
import { useCircleAccessState } from "../hooks/useCircleAccessState";
import { useCircleSharePromptSequence } from "../hooks/useCircleSharePromptSequence";

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
  } = useNoteImages(NOTE_STORAGE_BUCKET);
  const { visible, hideTooltip, showTooltip, hasSeen } = useTooltipManager();
  const gallery = useGalleryLightbox(NOTE_STORAGE_BUCKET);

  // Quick log / edit modals
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

  // Toasts
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reflectionActivity, setReflectionActivity] = useState<any | null>(null);
  const [noteOnlyActivityId, setNoteOnlyActivityId] = useState<string | null>(null);
  const [journalEntryDraftOpen, setJournalEntryDraftOpen] = useState(false);
  const [editingJournalEntry, setEditingJournalEntry] = useState<any | null>(null);
  const [quickFeelingSavingId, setQuickFeelingSavingId] = useState<string | null>(null);
  const [quickEffortSavingId, setQuickEffortSavingId] = useState<string | null>(null);
  const noteFlow = usePostLogNoteFlow();

  // Sidebar
  // Delete / undo
  const lastDeletedRef = useRef<any | null>(null);

  // Infinite scroll feed
  const {
    activities,
    setActivities,
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
    setShowAddSheet(true);
  };

  async function refreshActivities() {
    if (!userId) return;

    await refreshFeed();
  }

  const shareableActivityIds = useMemo(
    () =>
      activities
        .filter((item) => item?.entry_kind !== "journal_entry")
        .map((item) => String(item.id)),
    [activities]
  );
  const { circleEnabled, hasAcceptedCircleConnections } = useCircleAccessState(userId);

  const {
    handleShareWithCircle,
    sharedWithCircleByActivity,
    sharingActivityId,
    shareActivityToCircle,
    unshareActivityFromCircle,
  } =
    useCircleActivitySharing({
      userId,
      circleEnabled,
      activityIds: shareableActivityIds,
      onToast: setToastMessage,
    });
  const {
    statusToast: noteOnlyStatusToast,
    sharePromptActivityId: noteOnlySharePromptActivityId,
    sharedToastActivityId: noteOnlySharedToastActivityId,
    showSavedStatus: showNoteOnlySavedStatus,
    showSkippedStatus: showNoteOnlySkippedStatus,
    closeStatusToast: closeNoteOnlyStatusToast,
    handleSharePrompt: handleNoteOnlySharePrompt,
    handleUndoShare: handleUndoNoteOnlyShare,
    dismissSharePrompt: dismissNoteOnlySharePrompt,
    dismissSharedToast: dismissNoteOnlySharedToast,
  } = useCircleSharePromptSequence({
    canPromptCircleShare: hasAcceptedCircleConnections,
    onShareWithCircle: (activityId) =>
      shareActivityToCircle(activityId, { silent: true }),
    onUndoShareWithCircle: (activityId) =>
      unshareActivityFromCircle(activityId, { silent: true }),
  });


  // --------------------------------------------------
  // INITIAL LOAD: user → feed
  // --------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        setUserId(user.id);
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
    if (
      hasAcceptedCircleConnections &&
      shareableActivityIds.length > 0 &&
      !hasSeen("circle_share_onboarding")
    ) {
      return;
    }
    if (activities.length >= 3) {
      showTooltip("tiny_tweak_prompt");
    }
  }, [
    activities.length,
    hasAcceptedCircleConnections,
    hasDoneOnboarding,
    hasSeen,
    initialFeedLoaded,
    shareableActivityIds.length,
    showTooltip,
  ]);

  useEffect(() => {
    if (!hasDoneOnboarding) return;
    if (!hasAcceptedCircleConnections) return;
    if (shareableActivityIds.length === 0) return;
    if (hasSeen("circle_share_onboarding")) return;
    if (visible !== null) return;
    showTooltip("circle_share_onboarding");
  }, [
    hasDoneOnboarding,
    hasAcceptedCircleConnections,
    hasSeen,
    shareableActivityIds.length,
    showTooltip,
    visible,
  ]);

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

  const latestStravaQuickPrompt = useMemo(() => {
    const imported = activities.filter(
      (item) => item?.entry_kind !== "journal_entry" && item?.source === "strava"
    );
    if (imported.length === 0) return { activityId: null as string | null, mode: null as "feeling" | "effort" | null };

    const latest = imported[0];
    const rawDate = latest.started_at || latest.created_at || latest.date;
    if (!rawDate) return { activityId: null as string | null, mode: null as "feeling" | "effort" | null };
    const timeMs = new Date(rawDate).getTime();
    if (!Number.isFinite(timeMs)) return { activityId: null as string | null, mode: null as "feeling" | "effort" | null };

    const ageHours = (Date.now() - timeMs) / (1000 * 60 * 60);
    if (ageHours > 48) return { activityId: null as string | null, mode: null as "feeling" | "effort" | null };

    const hasNote = Boolean(latest.notes?.trim?.());
    if (hasNote) return { activityId: null as string | null, mode: null as "feeling" | "effort" | null };

    const hasFeeling =
      typeof latest.feeling === "number" &&
      Number.isFinite(latest.feeling) &&
      latest.feeling > 0;
    if (!hasFeeling) {
      return { activityId: latest.id as string, mode: "feeling" as const };
    }

    const hasEffort =
      typeof latest.effort === "number" &&
      Number.isFinite(latest.effort) &&
      latest.effort > 0;
    if (!hasEffort) {
      return { activityId: latest.id as string, mode: "effort" as const };
    }

    return { activityId: null as string | null, mode: null as "feeling" | "effort" | null };
  }, [activities]);

  const handleQuickFeelingSelect = async (activity: any, feeling: number) => {
    if (!activity?.id) return;
    setQuickFeelingSavingId(activity.id);
    try {
      const { error } = await updateActivityFeeling(activity.id, feeling);
      if (error) throw error;
      setActivities((prev) =>
        prev.map((item) => (item.id === activity.id ? { ...item, feeling } : item))
      );
    } catch (err: any) {
      setToastMessage(err?.message || "Could not save feeling.");
    } finally {
      setQuickFeelingSavingId(null);
    }
  };

  const handleQuickEffortSelect = async (activity: any, effort: number) => {
    if (!activity?.id) return;
    setQuickEffortSavingId(activity.id);
    try {
      const { error } = await updateActivityEffort(activity.id, effort);
      if (error) throw error;
      setActivities((prev) =>
        prev.map((item) => (item.id === activity.id ? { ...item, effort } : item))
      );
    } catch (err: any) {
      setToastMessage(err?.message || "Could not save effort.");
    } finally {
      setQuickEffortSavingId(null);
    }
  };

  const handleQuickAddNote = (activity: any) => {
    if (!activity?.id) return;
    setNoteOnlyActivityId(activity.id);
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
  let activityRenderIndex = 0;

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
                                onClick={
                                  a.entry_type === "journal_note"
                                    ? () => setEditingJournalEntry(a)
                                    : undefined
                                }
                              />
                            );
                          }

                          const currentActivityIndex = activityRenderIndex;
                          activityRenderIndex += 1;
                          const showAfterLogTooltip =
                            visible === "after_first_log" && currentActivityIndex === 0;
                          const showCircleShareOnboardingTooltip =
                            hasDoneOnboarding &&
                            visible === "circle_share_onboarding" &&
                            currentActivityIndex === 0;
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
                              tooltipVisible={
                                showAfterLogTooltip ||
                                showCircleShareOnboardingTooltip
                              }
                              tooltipAnchor={
                                showCircleShareOnboardingTooltip ? "share" : "card"
                              }
                              tooltipContent={
                                showCircleShareOnboardingTooltip ? (
                                  <div>
                                    <div className="font-semibold text-gray-900">
                                      Share with your Circle
                                    </div>
                                    <p className="mt-2 text-sm leading-5 text-gray-700">
                                      When you choose to share an activity, your Circle can
                                      see the activity title, distance and duration if
                                      available, and photos if you added them. Your notes
                                      always stay private. You can unshare any activity
                                      anytime.
                                    </p>
                                    <button
                                      type="button"
                                      className="mt-3 inline-flex rounded-full bg-movenotes-primary px-3 py-1.5 text-sm font-medium text-primary-text"
                                      onClick={hideTooltip}
                                    >
                                      Got it
                                    </button>
                                  </div>
                                ) : undefined
                              }
                              onTooltipClose={hideTooltip}
                              onOpenGallery={(activity) => {
                                const items = buildGalleryItemsForActivity(activity);
                                gallery.openGallery(items, 0);
                              }}
                              onAddReflection={(activity) => setReflectionActivity(activity)}
                              onAddNoteOnly={handleQuickAddNote}
                              showQuickFeelingPrompt={
                                a.id === latestStravaQuickPrompt.activityId &&
                                latestStravaQuickPrompt.mode === "feeling"
                              }
                              showQuickEffortPrompt={
                                a.id === latestStravaQuickPrompt.activityId &&
                                latestStravaQuickPrompt.mode === "effort"
                              }
                              onQuickFeelingSelect={handleQuickFeelingSelect}
                              onQuickEffortSelect={handleQuickEffortSelect}
                              quickFeelingSaving={quickFeelingSavingId === a.id}
                              quickEffortSaving={quickEffortSavingId === a.id}
                              canShareWithCircle={circleEnabled}
                              onShareWithCircle={handleShareWithCircle}
                              sharedWithCircle={Boolean(sharedWithCircleByActivity[a.id])}
                              sharingWithCircle={sharingActivityId === a.id}
                              disableSwipe={gallery.open}
                              imageLoading={
                                currentActivityIndex < 4 ? "eager" : "lazy"
                              }
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

        {/* -------------------------------------------------- */}
        {/* MODALS & TOASTS                                    */}
        {/* -------------------------------------------------- */}
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
            void refreshActivities();
          }}
          onDeleted={() => {
            setJournalEntryDraftOpen(false);
            setEditingJournalEntry(null);
            setToastMessage("Journal entry deleted");
            void refreshActivities();
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

        {noteOnlyActivityId && (
          <AddNoteModal
            activityId={noteOnlyActivityId}
            onSave={() => {
              const activityId = noteOnlyActivityId;
              setNoteOnlyActivityId(null);
              playWritingSound();
              refreshActivities();
              if (activityId) {
                showNoteOnlySavedStatus(activityId);
              }
            }}
            onSkip={() => {
              const activityId = noteOnlyActivityId;
              setNoteOnlyActivityId(null);
              if (activityId) {
                showNoteOnlySkippedStatus(activityId);
              }
            }}
          />
        )}

        {toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )}

        <PostLogNoteFlow
          flow={noteFlow}
          onRefreshAfterNote={refreshActivities}
          canPromptCircleShare={hasAcceptedCircleConnections}
          onShareWithCircle={(activityId) =>
            shareActivityToCircle(activityId, { silent: true })
          }
          onUndoShareWithCircle={(activityId) =>
            unshareActivityFromCircle(activityId, { silent: true })
          }
        />

        {noteOnlyStatusToast && (
          <Toast
            icon={null}
            durationMs={1500}
            message={
              noteOnlyStatusToast.type === "saved"
                ? "Notes saved to journal"
                : "Notes skipped"
            }
            onClose={closeNoteOnlyStatusToast}
          />
        )}

        {noteOnlySharePromptActivityId && (
          <Toast
            icon={null}
            durationMs={8000}
            message={
              <button
                type="button"
                className="underline"
                onClick={() => void handleNoteOnlySharePrompt(noteOnlySharePromptActivityId)}
              >
                Share with circle
              </button>
            }
            onClose={dismissNoteOnlySharePrompt}
          />
        )}

        {noteOnlySharedToastActivityId && (
          <Toast
            icon={null}
            durationMs={4000}
            message={
              <>
                Shared with your circle ·{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void handleUndoNoteOnlyShare(noteOnlySharedToastActivityId)}
                >
                  Undo
                </button>
              </>
            }
            onClose={dismissNoteOnlySharedToast}
          />
        )}

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
