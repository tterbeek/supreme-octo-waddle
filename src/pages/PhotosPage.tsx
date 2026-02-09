import { useEffect, useMemo, useRef, useState } from "react";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { useHomeFeed } from "../hooks/useHomeFeed";
import { useNoteImages } from "../hooks/useNoteImages";
import { useLayoutChrome } from "../contexts/LayoutChromeContext";
import { getCurrentUser } from "../services/auth.service";

const NOTE_BUCKET = "actvity-notes";
const SWIPE_THRESHOLD = 50;

const getActivityDateValue = (activity: any) => {
  const raw =
    activity?.date ||
    activity?.day ||
    activity?.journal_created_at ||
    activity?.created_at ||
    activity?.inserted_at ||
    activity?.updated_at;
  if (!raw) return 0;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getTime();
};

const formatActivityMeta = (activity: any) => {
  const dateValue = getActivityDateValue(activity);
  const dateLabel = dateValue
    ? new Date(dateValue).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "";
  const typeConfig = ACTIVITY_TYPES[activity?.type] ?? ACTIVITY_TYPES["other"];
  const typeLabel = activity?.title || typeConfig?.label || activity?.type || "Activity";
  return [dateLabel, typeLabel].filter(Boolean).join(" · ");
};

const getNoteText = (activity: any) => {
  const note =
    activity?.notes ||
    activity?.entry_text ||
    activity?.text ||
    activity?.journal_entry ||
    "";
  if (typeof note !== "string") return "";
  return note.trim();
};

export default function PhotosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chromeVisible, setChromeVisible] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const ignoreClickRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { setChromeHidden } = useLayoutChrome();

  const { activities, initialFeedLoaded } = useHomeFeed(userId);
  const { signedNoteImages, signedNoteThumbs, resolveFor } = useNoteImages(NOTE_BUCKET);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);
    };

    load();
  }, []);

  const photoActivities = useMemo(
    () => activities.filter((a) => a?.note_image_url || a?.note_thumb_image_url),
    [activities]
  );

  const orderedPhotos = useMemo(() => {
    return [...photoActivities].sort(
      (a, b) => getActivityDateValue(b) - getActivityDateValue(a)
    );
  }, [photoActivities]);

  useEffect(() => {
    return resolveFor(photoActivities);
  }, [photoActivities, resolveFor]);

  const activeIndex = useMemo(() => {
    if (!activeId) return -1;
    return orderedPhotos.findIndex((activity) => activity.id === activeId);
  }, [activeId, orderedPhotos]);

  const activeActivity = activeIndex >= 0 ? orderedPhotos[activeIndex] : null;
  const activeImage = activeActivity
    ? signedNoteImages[activeActivity.id] || signedNoteThumbs[activeActivity.id]
    : "";
  const activeNoteText = activeActivity ? getNoteText(activeActivity) : "";

  useEffect(() => {
    if (!activeId) return;
    if (activeIndex === -1) {
      setActiveId(null);
      setChromeVisible(false);
      setNoteExpanded(false);
    }
  }, [activeId, activeIndex]);

  useEffect(() => {
    if (activeActivity) {
      setChromeHidden(true);
      return () => setChromeHidden(false);
    }
    setChromeHidden(false);
    return () => setChromeHidden(false);
  }, [activeActivity, setChromeHidden]);

  useEffect(() => {
    if (!activeId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeId]);

  const openViewer = (activityId: string) => {
    setActiveId(activityId);
    setChromeVisible(false);
    setNoteExpanded(false);
  };

  const closeViewer = () => {
    setActiveId(null);
    setChromeVisible(false);
    setNoteExpanded(false);
  };

  const goToIndex = (nextIndex: number) => {
    const next = orderedPhotos[nextIndex];
    if (!next) return;
    setActiveId(next.id);
    setChromeVisible(true);
    setNoteExpanded(false);
  };

  const goToNewer = () => {
    if (activeIndex <= 0) return;
    goToIndex(activeIndex - 1);
  };

  const goToOlder = () => {
    if (activeIndex < 0 || activeIndex >= orderedPhotos.length - 1) return;
    goToIndex(activeIndex + 1);
  };

  const handleTap = () => {
    setChromeVisible((prev) => !prev);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    ignoreClickRef.current = true;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < 10 && absY < 10) {
      handleTap();
      return;
    }

    if (absX > absY && absX > SWIPE_THRESHOLD) {
      if (dx < 0) {
        goToNewer();
      } else {
        goToOlder();
      }
      return;
    }

    if (absY > absX && absY > SWIPE_THRESHOLD) {
      setChromeVisible(true);
      setNoteExpanded(dy < 0);
    }
  };

  const handleOverlayClick = () => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    handleTap();
  };

  const hasPhotos = orderedPhotos.length > 0;

  return (
    <div className="min-h-screen bg-movenotes-bg p-2">
      <div className="mt-2">
        {hasPhotos ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {orderedPhotos.map((activity) => {
              const thumbUrl =
                signedNoteThumbs[activity.id] || signedNoteImages[activity.id];

              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => openViewer(activity.id)}
                  className="relative aspect-square overflow-hidden rounded-xl border border-movenotes-border bg-movenotes-surface shadow-sm"
                  aria-label="Open activity photo"
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt="Activity"
                      loading="lazy"
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="h-full w-full bg-movenotes-bg" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          initialFeedLoaded && (
            <div className="text-center text-movenotes-muted text-sm py-16">
              Photos from your activities will appear here.
            </div>
          )
        )}
      </div>

      {activeActivity && (
        <div
          className="fixed inset-0 z-[70] bg-black text-white"
          role="dialog"
          aria-modal="true"
          onClick={handleOverlayClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {activeImage ? (
            <img
              src={activeImage}
              alt="Activity"
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/70">
              Loading photo...
            </div>
          )}

          {chromeVisible && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeViewer();
                }}
                className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-2 text-sm text-white/90 backdrop-blur"
                aria-label="Back to photos"
              >
                Back
              </button>

              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                {!noteExpanded ? (
                  <p
                    className="text-sm leading-snug text-white/90"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    <span className="block font-medium text-white">
                      {formatActivityMeta(activeActivity)}
                    </span>
                    {activeNoteText && (
                      <span className="block">{activeNoteText}</span>
                    )}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white">
                      {formatActivityMeta(activeActivity)}
                    </div>
                    {activeNoteText && (
                      <div className="text-base text-white/90 leading-relaxed max-h-[45vh] overflow-y-auto pr-1">
                        {activeNoteText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
