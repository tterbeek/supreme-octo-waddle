import { type ReactNode, useEffect, useRef, useState } from "react";
import { MapPin, Zap } from "lucide-react";
import {
  IconBoxMultiple2,
  IconBoxMultiple3,
  IconBoxMultiple4,
  IconBoxMultiple5,
  IconBoxMultiple6,
  IconBoxMultiple7,
  IconBoxMultiple8,
  IconBoxMultiple9,
  IconChevronRight,
  IconMoodEmpty,
  IconMoodHappy,
  IconMoodSad,
  IconMoodSmile,
  IconMoodSpark,
  IconShare,
} from "@tabler/icons-react";
import SwipeActions from "./SwipeActions";
import TooltipBubble from "./TooltipBubble";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { resolveFeelingState, type FeelingAfter, type FeelingDuring } from "../lib/feelings";
import { formatDistance, formatDurationMinutes, type UnitSystem } from "../lib/units";
import { getActivityPhotos } from "../lib/photos";

type RecentActivityCardProps = {
  imageLoading?: "lazy" | "eager";
  activity: any;
  signedNoteImages: Record<string, string>;
  signedNoteThumbs: Record<string, string>;
  noteImageOrientation: Record<string, "portrait" | "landscape">;
  onEdit: (activity: any) => void;
  onNoteImageLoad: (activityId: string, naturalWidth: number, naturalHeight: number) => void;
  unitSystem: UnitSystem;
  tooltipVisible: boolean;
  tooltipContent?: ReactNode;
  tooltipAnchor?: "card" | "share";
  onTooltipClose: () => void;
  onOpenGallery: (activity: any) => void;
  onAddReflection?: (activity: any) => void;
  onAddNoteOnly?: (activity: any) => void;
  onQuickFeelingSelect?: (
    activity: any,
    selection: {
      stage: "during" | "after";
      value: FeelingDuring | FeelingAfter;
    }
  ) => void;
  showQuickFeelingPrompt?: boolean;
  onQuickEffortSelect?: (activity: any, effort: number) => void;
  showQuickEffortPrompt?: boolean;
  quickFeelingSaving?: boolean;
  quickEffortSaving?: boolean;
  onShareWithCircle?: (activity: any) => void;
  canShareWithCircle?: boolean;
  sharedWithCircle?: boolean;
  sharingWithCircle?: boolean;
  disableSwipe?: boolean;
};

export default function RecentActivityCard({
  activity,
  signedNoteImages,
  signedNoteThumbs,
  noteImageOrientation,
  onEdit,
  onNoteImageLoad,
  unitSystem,
  tooltipVisible,
  tooltipContent,
  tooltipAnchor = "card",
  onTooltipClose,
  onOpenGallery,
  onAddReflection,
  onAddNoteOnly,
  onQuickFeelingSelect,
  showQuickFeelingPrompt = false,
  onQuickEffortSelect,
  showQuickEffortPrompt = false,
  quickFeelingSaving = false,
  quickEffortSaving = false,
  onShareWithCircle,
  canShareWithCircle = false,
  sharedWithCircle = false,
  sharingWithCircle = false,
  disableSwipe = false,
  imageLoading = "lazy",
}: RecentActivityCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [shareTooltipWidth, setShareTooltipWidth] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const shareTooltipAnchorRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cachedImageHandledRef = useRef<string | null>(null);
  const onNoteImageLoadRef = useRef(onNoteImageLoad);
  const pointerTypeRef = useRef<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);
  const typeConfig = ACTIVITY_TYPES[activity.type] ?? ACTIVITY_TYPES["other"];
  const TypeIcon = typeConfig.Icon;
  const formattedDistance =
    activity.distance_km != null
      ? formatDistance(Number(activity.distance_km), unitSystem)
      : null;
  const equipmentItems: Array<{ id: string; name: string }> =
    activity.equipment ||
    activity.activity_equipment?.map((item: any) => item?.equipment).filter(Boolean) ||
    [];
  const equipmentName = (() => {
    if (!equipmentItems.length) return "";
    const first = equipmentItems[0];
    return typeof first?.name === "string" ? first.name.trim() : "";
  })();
  const locationName =
    typeof activity.locationTag?.value === "string"
      ? activity.locationTag.value.trim()
      : "";
  const durationLabel =
    activity.duration_min != null
      ? formatDurationMinutes(Number(activity.duration_min))
      : null;
  const metricParts = [formattedDistance, durationLabel].filter(
    (value): value is string => Boolean(value)
  );
  const thumbUrl = signedNoteThumbs[activity.id] || signedNoteImages[activity.id];
  const photoCount = getActivityPhotos(activity).length;
  const stravaSource = activity.source === "strava";
  const isImportedActivity =
    (typeof activity.source === "string" && activity.source !== "manual") ||
    Boolean(activity.external_source);
  const stravaSportLabel = (() => {
    if (!stravaSource) return null;
    const raw = activity.raw_sport_type || activity.raw_type;
    if (!raw || typeof raw !== "string") return "Strava";
    const spaced = raw
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .trim();
    return `Strava · ${spaced}`;
  })();
  const { during: feelingDuring, after: feelingAfter } = resolveFeelingState(activity);
  const quickFeelingStage: "during" | "after" = feelingDuring ? "after" : "during";
  const effortValue =
    typeof activity.effort === "number" && Number.isFinite(activity.effort)
      ? Math.max(0, Math.trunc(activity.effort))
      : 0;
  const showFeeling = Boolean(feelingDuring);
  const showEffort = effortValue > 0;
  const hasNotes = Boolean(activity.notes?.trim?.());
  const hasNoteOrFeeling = hasNotes || showFeeling;
  const activityDateMs = (() => {
    const raw = activity.started_at || activity.created_at || activity.date;
    if (!raw) return null;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : null;
  })();
  const ageHours =
    activityDateMs != null ? (Date.now() - activityDateMs) / (1000 * 60 * 60) : null;
  const isOlderThan7Days = ageHours != null && ageHours > 24 * 7;
  const showAddReflection =
    isImportedActivity &&
    Boolean(onAddReflection) &&
    !hasNoteOrFeeling &&
    !showQuickFeelingPrompt &&
    !showQuickEffortPrompt &&
    !isOlderThan7Days;
  const showOptionalNotePrompt =
    isImportedActivity &&
    Boolean(onAddReflection) &&
    !hasNotes &&
    showFeeling &&
    !showQuickEffortPrompt &&
    !showQuickFeelingPrompt;
  const showShareWithCircle = canShareWithCircle && Boolean(onShareWithCircle);
  const shareTooltipClassName = "max-w-none p-4 text-left";
  const shareTooltipWrapperClassName = "right-0 left-auto translate-x-0";

  const renderFeelingIcon = (
    feeling: FeelingDuring | FeelingAfter | null,
    className = "w-5 h-5 md:w-6 md:h-6"
  ) => {
    if (!feeling) return null;

    switch (feeling) {
      case "sad":
        return <IconMoodSad className={`${className} text-movenotes-accent`} strokeWidth={1.8} />;
      case "neutral":
        return <IconMoodEmpty className={`${className} text-movenotes-accent`} strokeWidth={1.8} />;
      case "smile":
        return <IconMoodSmile className={`${className} text-movenotes-accent`} strokeWidth={1.8} />;
      case "happy":
        return <IconMoodHappy className={`${className} text-movenotes-accent`} strokeWidth={1.8} />;
      case "spark":
        return <IconMoodSpark className={`${className} text-movenotes-accent`} strokeWidth={1.8} />;
      default:
        return null;
    }
  };
  const quickFeelingOptions =
    quickFeelingStage === "during"
      ? ([
          { value: "sad", label: "Struggling" },
          { value: "neutral", label: "Neutral" },
          { value: "smile", label: "Flowing" },
          { value: "happy", label: "Energized" },
        ] as const)
      : ([
          { value: "sad", label: "Drained" },
          { value: "smile", label: "Relaxed" },
          { value: "happy", label: "Good" },
          { value: "spark", label: "Uplifted" },
        ] as const);
  useEffect(() => {
    onNoteImageLoadRef.current = onNoteImageLoad;
  }, [onNoteImageLoad]);

  useEffect(() => {
    if (!tooltipVisible || tooltipAnchor !== "share") return;

    const updateShareTooltipWidth = () => {
      const cardEl = cardRef.current;
      const shareAnchorEl = shareTooltipAnchorRef.current;
      if (!cardEl || !shareAnchorEl) return;

      const cardRect = cardEl.getBoundingClientRect();
      const shareRect = shareAnchorEl.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.round(shareRect.right - cardRect.left));
      setShareTooltipWidth(nextWidth);
    };

    updateShareTooltipWidth();
    window.addEventListener("resize", updateShareTooltipWidth);
    return () => {
      window.removeEventListener("resize", updateShareTooltipWidth);
    };
  }, [tooltipAnchor, tooltipVisible]);

  const countIcon = (() => {
    if (photoCount <= 1) return null;
    if (photoCount === 2) return IconBoxMultiple2;
    if (photoCount === 3) return IconBoxMultiple3;
    if (photoCount === 4) return IconBoxMultiple4;
    if (photoCount === 5) return IconBoxMultiple5;
    if (photoCount === 6) return IconBoxMultiple6;
    if (photoCount === 7) return IconBoxMultiple7;
    if (photoCount === 8) return IconBoxMultiple8;
    return IconBoxMultiple9;
  })();

  useEffect(() => {
    setImageLoaded(false);
    cachedImageHandledRef.current = null;
  }, [thumbUrl]);

  useEffect(() => {
    const imageEl = imageRef.current;
    if (!thumbUrl || !imageEl) return;
    if (!imageEl.complete || imageEl.naturalWidth === 0 || imageEl.naturalHeight === 0) {
      return;
    }
    if (cachedImageHandledRef.current === thumbUrl) {
      return;
    }

    cachedImageHandledRef.current = thumbUrl;
    onNoteImageLoadRef.current(activity.id, imageEl.naturalWidth, imageEl.naturalHeight);
    setImageLoaded(true);
  }, [activity.id, thumbUrl]);

  return (
    <SwipeActions onEdit={() => onEdit(activity)} disabled={disableSwipe}>
      <div
        ref={cardRef}
        className="
          relative rounded-xl p-5 bg-warm-100 border border-warm-200 shadow-sm text-center
          w-full mx-auto
          max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl
          sm:p-6 md:p-7
        "
        onClick={(e) => {
          e.stopPropagation();
          const target = e.target as HTMLElement | null;
          if (target?.closest?.("[data-photo-trigger]")) return;
          onEdit(activity);
        }}
      >
        {tooltipVisible && tooltipAnchor === "card" && (
          <TooltipBubble position="top" onClose={onTooltipClose}>
            {tooltipContent ?? "Create a preset to make logging this activity faster next time."}
          </TooltipBubble>
        )}

        <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
          <TypeIcon size={24} strokeWidth={1.8} />
          <span className="font-semibold text-gray-900 text-base md:text-lg leading-tight">
            {activity.title || typeConfig.label}
          </span>
          {showShareWithCircle && (
            <div ref={shareTooltipAnchorRef} className="relative inline-flex items-center">
              {tooltipVisible && tooltipAnchor === "share" && (
                <TooltipBubble
                  position="bottom"
                  className={shareTooltipClassName}
                  wrapperClassName={shareTooltipWrapperClassName}
                  style={
                    shareTooltipWidth != null
                      ? { width: `${shareTooltipWidth}px` }
                      : undefined
                  }
                  onClose={onTooltipClose}
                >
                  {tooltipContent ?? "Create a preset to make logging this activity faster next time."}
                </TooltipBubble>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onShareWithCircle?.(activity);
                }}
                disabled={sharingWithCircle}
                aria-label={sharedWithCircle ? "Unshare from Circle" : "Share with Circle"}
                title={sharedWithCircle ? "Unshare from Circle" : "Share with Circle"}
                className={`disabled:opacity-60 ${
                  sharedWithCircle ? "text-movenotes-primary" : "text-gray-300"
                } ${sharingWithCircle ? "animate-pulse" : ""}`}
              >
                <IconShare size={16} strokeWidth={1.9} />
              </button>
            </div>
          )}
        </div>

        {stravaSportLabel && (
          <div className="text-xs text-gray-500 mb-1">{stravaSportLabel}</div>
        )}

        {metricParts.length > 0 && (
          <div className="text-sm md:text-base text-gray-700 flex items-center justify-center gap-2 mb-1 flex-wrap">
            {metricParts.map((part, index) => (
              <span key={`${part}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 && <span className="text-gray-400">·</span>}
                <span>{part}</span>
              </span>
            ))}
          </div>
        )}

        {(locationName || equipmentName) && (
          <div className="mb-1 flex items-center justify-center gap-2 text-sm text-gray-600 min-w-0 overflow-hidden whitespace-nowrap">
            {locationName && (
              <span
                className={`inline-flex min-w-0 items-center gap-1 ${
                  equipmentName ? "max-w-[55%]" : "max-w-full"
                }`}
              >
                <MapPin size={14} strokeWidth={1.8} className="shrink-0" />
                <span className="truncate">{locationName}</span>
              </span>
            )}
            {locationName && equipmentName && (
              <span className="shrink-0 text-gray-400">·</span>
            )}
            {equipmentName && (
              <span
                className={`min-w-0 truncate ${
                  locationName ? "max-w-[45%]" : "max-w-full"
                }`}
              >
                {equipmentName}
              </span>
            )}
          </div>
        )}

        {(showFeeling || showEffort) && (
          <div className="flex items-center justify-center gap-6 my-3">
            {showFeeling && (
              <div className="flex items-center justify-center gap-1">
                {renderFeelingIcon(feelingDuring)}
                {feelingAfter ? (
                  <>
                    <IconChevronRight
                      className="h-3.5 w-3.5 text-gray-400 transition-opacity duration-150"
                      strokeWidth={1.6}
                    />
                    {renderFeelingIcon(feelingAfter)}
                  </>
                ) : null}
              </div>
            )}

            <div className="flex items-center gap-1 md:gap-1.5">
              {Array.from({ length: effortValue }).map((_, i) => (
                <Zap
                  key={i}
                  className="w-4 h-4 md:w-5 md:h-5 text-movenotes-accent"
                />
              ))}
            </div>
          </div>
        )}

        {showQuickFeelingPrompt && Boolean(onQuickFeelingSelect) && (
          <div className="mt-3 mb-2">
            <p className="text-sm text-gray-700 mb-1">
              {quickFeelingStage === "during"
                ? "How did it feel?"
                : "How does it feel afterward?"}
            </p>
            <p className="text-xs text-gray-500 mb-2">
              {quickFeelingStage === "during" ? "During" : "After"}
            </p>
            <div className="flex justify-between w-full max-w-sm mx-auto">
              {quickFeelingOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={quickFeelingSaving}
                  onClick={(event) => {
                    event.stopPropagation();
                    onQuickFeelingSelect?.(activity, {
                      stage: quickFeelingStage,
                      value,
                    });
                  }}
                  aria-label={label}
                  className="transition transform active:scale-95 opacity-90 disabled:opacity-60"
                >
                  {renderFeelingIcon(value, "w-7 h-7")}
                </button>
              ))}
            </div>
            {quickFeelingStage === "after" && (
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (onAddNoteOnly) {
                      onAddNoteOnly(activity);
                    } else {
                      onAddReflection?.(activity);
                    }
                  }}
                  className="text-xs text-movenotes-primary underline"
                >
                  Skip to add note
                </button>
              </div>
            )}
          </div>
        )}

        {showQuickEffortPrompt && Boolean(onQuickEffortSelect) && (
          <div className="mt-3 mb-2">
            <p className="text-sm text-gray-700 mb-2 text-center">effort?</p>
            <div className="flex justify-between w-full max-w-sm mx-auto">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={quickEffortSaving}
                  onClick={(event) => {
                    event.stopPropagation();
                    onQuickEffortSelect?.(activity, value);
                  }}
                  aria-label={`Effort ${value}`}
                  className="transition transform active:scale-95 disabled:opacity-60"
                >
                  <Zap className="w-5 h-5 text-gray-500" />
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (onAddNoteOnly) {
                    onAddNoteOnly(activity);
                  } else {
                    onAddReflection?.(activity);
                  }
                }}
                className="text-xs text-movenotes-primary underline"
              >
                Add note
              </button>
            </div>
          </div>
        )}

        {(activity.notes?.trim() || thumbUrl) && (
          <div className="mt-3 space-y-2">
            {activity.notes?.trim() && (
              <p
                className="
                  text-[15px] md:text-[17px]
                  text-movenotes-text/80 font-[DMSerifDisplay] italic leading-snug
                  max-w-xs sm:max-w-sm md:max-w-md mx-auto
                "
              >
                “{activity.notes}”
              </p>
            )}

            {thumbUrl && (
              <div
                className="relative inline-block"
                data-photo-trigger="true"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  pointerTypeRef.current = e.pointerType;
                  if (e.pointerType === "touch") {
                    touchStartRef.current = { x: e.clientX, y: e.clientY };
                    touchMovedRef.current = false;
                  }
                }}
                onPointerMove={(e) => {
                  if (pointerTypeRef.current !== "touch") return;
                  if (!touchStartRef.current) return;
                  const dx = Math.abs(e.clientX - touchStartRef.current.x);
                  const dy = Math.abs(e.clientY - touchStartRef.current.y);
                  if (dx > 8 || dy > 8) {
                    touchMovedRef.current = true;
                  }
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (pointerTypeRef.current === "touch") {
                    const moved = touchMovedRef.current;
                    touchStartRef.current = null;
                    if (moved) return;
                  }
                  if (photoCount > 0) onOpenGallery(activity);
                }}
                onPointerCancel={() => {
                  touchStartRef.current = null;
                  touchMovedRef.current = false;
                }}
              >
                <img
                  ref={imageRef}
                  src={thumbUrl}
                  alt="Activity note"
                  loading={imageLoading}
                  className={`
                    rounded-xl border border-warm-200 shadow-sm transition-opacity duration-200
                    ${
                      noteImageOrientation[activity.id] === "portrait"
                        ? "max-h-60 w-auto max-w-full mx-auto object-contain"
                        : "w-full max-h-56 object-cover"
                    }
                    ${imageLoaded ? "opacity-100" : "opacity-0"}
                  `}
                  data-photo-trigger="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (pointerTypeRef.current && pointerTypeRef.current !== "mouse") {
                      return;
                    }
                    if (photoCount > 0) onOpenGallery(activity);
                  }}
                  onLoad={(e) => {
                    const { naturalWidth, naturalHeight } = e.currentTarget;
                    onNoteImageLoad(activity.id, naturalWidth, naturalHeight);
                    setImageLoaded(true);
                  }}
                />
                {countIcon && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/70 text-white text-[11px] font-semibold px-2 py-0.5">
                    {(() => {
                      const CountIcon = countIcon;
                      return <CountIcon size={14} strokeWidth={2} />;
                    })()}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {showAddReflection && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddReflection?.(activity);
              }}
              className="text-xs text-movenotes-primary underline"
            >
              Add reflection
            </button>
          </div>
        )}

        {showOptionalNotePrompt && !showQuickEffortPrompt && (
          <div className="mt-3 flex items-center justify-center">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (onAddNoteOnly) {
                  onAddNoteOnly(activity);
                } else {
                  onAddReflection?.(activity);
                }
              }}
              className="text-xs text-movenotes-primary underline"
            >
              Add note
            </button>
          </div>
        )}
      </div>
    </SwipeActions>
  );
}
