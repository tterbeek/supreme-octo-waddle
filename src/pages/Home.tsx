// src/pages/Home.tsx
import { useEffect, useState, useRef } from "react";
import AddActivityModal from "../features/activities/AddActivityModal";
import { SelectActivityTypeModal } from "../components/SelectActivityTypeModal";
import Toast from "../components/Toast";
import AddNoteModal from "../components/AddNoteModal";
import EditActivityModal from "../features/activities/EditActivityModal";
import SearchBar from "../components/SearchBar";
import RecentActivityCard from "../components/RecentActivityCard";
import { useTooltipManager } from "../hooks/useTooltipManager";
import { useUnitSystem } from "../contexts/UnitContext";
import { formatDistance } from "../lib/units";
import { getCurrentUser } from "../services/auth.service";
import { restoreActivity } from "../services/activities.service";
import { useHomeFeed } from "../hooks/useHomeFeed";
import { useNoteImages } from "../hooks/useNoteImages";
import { useLightbox } from "../hooks/useLightbox";
import { useHomeNotes } from "../hooks/useHomeNotes";
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
  const [showToast, setShowToast] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const {
    lastActivityId,
    setLastActivityId,
    showNotePrompt,
    setShowNotePrompt,
    showNoteSkippedToast,
    setShowNoteSkippedToast,
    showNoteSavedToast,
    setShowNoteSavedToast,
  } = useHomeNotes();

  // Sidebar
  // Delete / undo
  const lastDeletedRef = useRef<any | null>(null);

  // Infinite scroll feed
  const {
    activities,
    filteredActivities,
    refresh: refreshFeed,
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
  } = useHomeFeed(userId);

  const openQuickLog = () => {
    hideTooltip();
    setSelectedType((prev) => prev ?? "run");
    setShowQuickLog(true);
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
  // SEARCH TOGGLE
  // --------------------------------------------------
  const toggleSearch = () => {
    if (searchOpen) {
      setSearchTerm("");
    }
    setSearchOpen(!searchOpen);
  };

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
      />

        <div className="flex flex-col gap-3 mt-1">
          {filteredActivities.map((a, idx) => {
            const showAfterLogTooltip = visible === "after_first_log" && idx === 0;
            return (
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
          })}
        </div>

        <button
          type="button"
          aria-label="Add activity"
          onClick={openQuickLog}
          className="fixed z-40 rounded-full bg-movenotes-primary text-primary-text shadow-lg shadow-movenotes-primary/30 active:scale-95 transition flex items-center justify-center text-2xl w-14 h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-movenotes-primary"
          style={{
            right: "calc(16px + env(safe-area-inset-right))",
            bottom: "calc(90px + env(safe-area-inset-bottom))",
          }}
        >
          +
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
              <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                <div className="absolute inset-4 rounded-3xl pointer-events-none shadow-md shadow-[rgba(0,0,0,0.15)]" />
                <img
                  src={lightbox.url}
                  alt="Activity note full size"
                  className="relative max-h-full max-w-full object-contain rounded-3xl"
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
              setLastActivityId(activityId);
              setShowToast(true);
              await refreshActivities();
            }}
          />
        )}

        {showNotePrompt && lastActivityId && (
          <AddNoteModal
            activityId={lastActivityId}
            onSave={() => {
              setShowNotePrompt(false);
              setShowNoteSavedToast(true);
              refreshActivities();
            }}
            onSkip={() => {
              setShowNotePrompt(false);
              setShowNoteSkippedToast(true);
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

        {showToast && (
          <Toast
            message="Activity logged ✅"
            onClose={() => {
              setShowToast(false);
              if (lastActivityId) {
                setTimeout(() => setShowNotePrompt(true), 250);
              }
            }}
          />
        )}

        {showNoteSavedToast && (
          <Toast
            message="Note saved 💾"
            onClose={() => setShowNoteSavedToast(false)}
          />
        )}

        {showNoteSkippedToast && (
          <Toast
            message="Note skipped ✋"
            onClose={() => setShowNoteSkippedToast(false)}
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
