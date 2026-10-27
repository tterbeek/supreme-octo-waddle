import ActivityPhotoPreview from './ActivityPhotoPreview';
import { type ReactNode, useEffect, useRef, useState } from "react";
import { MapPin, Zap } from "lucide-react";
import { SOCIAL_V2_ENABLED } from '../config/social';
import ActivitySharingSheet from './social/ActivitySharingSheet';
import {
  IconChevronRight,
  IconMoodEmpty,
  IconMoodHappy,
  IconMoodSad,
  IconMoodSmile,
  IconMoodSpark,
  IconShare,
  IconDotsVertical,
  IconTrash,
} from "@tabler/icons-react";
import SwipeActions from "./SwipeActions";
import TooltipBubble from "./TooltipBubble";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { resolveFeelingState, type FeelingAfter, type FeelingDuring } from "../lib/feelings";
import { formatDistance, formatDurationMinutes, type UnitSystem } from "../lib/units";
import { getActivityPhotos } from "../lib/photos";
import { needsImportedEnrichment } from "../lib/importedActivity";
import ActivitySourceMark from "./ActivitySourceMark";
import DialogSheet from "./DialogSheet";
import DeleteActivityDialog from "./DeleteActivityDialog";

type RecentActivityCardProps = {
  imageLoading?: "lazy" | "eager";
  activity: any;
  signedNoteImages: Record<string, string>;
  signedNoteThumbs: Record<string, string>;
  noteImageOrientation: Record<string, "portrait" | "landscape">;
  onEdit: (activity: any) => void;
  onShareImage?: (activity: any) => void;
  onDeleted?: () => void;
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
  onEdit,
  onShareImage,
  onDeleted,
  onNoteImageLoad,
  unitSystem,
  tooltipVisible,
  tooltipContent,
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<"share" | "delete" | "audiences" | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [actionsOpen]);
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
  const importedSource = isImportedActivity && !stravaSource
    ? String(activity.source || activity.external_source)
    : null;
  const { during: feelingDuring, after: feelingAfter } = resolveFeelingState(activity);
  const quickFeelingStage: "during" | "after" = feelingDuring ? "after" : "during";
  const effortValue =
    typeof activity.effort === "number" && Number.isFinite(activity.effort)
      ? Math.max(0, Math.trunc(activity.effort))
      : 0;
  const showFeeling = Boolean(feelingDuring);
  const showEffort = effortValue > 0;
  const hasNotes = Boolean(activity.notes?.trim?.());
  const showOptionalNotePrompt =
    isImportedActivity &&
    Boolean(onAddReflection) &&
    !hasNotes &&
    showFeeling &&
    !showQuickEffortPrompt &&
    !showQuickFeelingPrompt;
  const showShareWithCircle = canShareWithCircle && Boolean(onShareWithCircle);

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

  return (
    <SwipeActions onEdit={() => onEdit(activity)} disabled={disableSwipe}>
      <div
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
        {tooltipVisible && (
          <TooltipBubble position="top" onClose={onTooltipClose}>
            {tooltipContent ?? "Create a preset to make logging this activity faster next time."}
          </TooltipBubble>
        )}

        {(onShareImage || onDeleted) && <div ref={actionsRef} className="absolute right-1 top-1" onClick={event => event.stopPropagation()} data-swipe-ignore="true"
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActionsOpen(false); }}
          onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setActionsOpen(false); actionsRef.current?.querySelector("button")?.focus(); } }}>
          <button type="button" aria-label="Activity actions" aria-expanded={actionsOpen} onClick={() => setActionsOpen(value => !value)} className="p-3 rounded-full text-gray-500 hover:bg-white/50"><IconDotsVertical size={18} /></button>
          {actionsOpen && <div className="absolute right-0 top-full z-10 w-44 rounded-xl border border-warm-200 bg-warm-100 p-1 shadow-lg">
            {onShareImage && <button type="button" className="w-full flex items-center gap-2 text-left px-3 py-3 text-sm rounded-lg hover:bg-white/60" onClick={() => { actionsRef.current?.querySelector("button")?.focus(); setActionsOpen(false); setActionDialog("share"); }}><IconShare size={16} strokeWidth={1.9} aria-hidden="true" />Share</button>}
            {onDeleted && <button type="button" className="w-full flex items-center gap-2 text-left px-3 py-3 text-sm rounded-lg hover:bg-white/60" onClick={() => { actionsRef.current?.querySelector("button")?.focus(); setActionsOpen(false); setActionDialog("delete"); }}><IconTrash size={16} strokeWidth={1.9} aria-hidden="true" />Delete activity</button>}
          </div>}
        </div>}

        {actionDialog && <div onClick={event => event.stopPropagation()} data-swipe-ignore="true">
          {actionDialog === "delete" && <DeleteActivityDialog activityId={activity.id} onClose={() => setActionDialog(null)} onDeleted={() => onDeleted?.()} />}
          {actionDialog === "audiences" && <ActivitySharingSheet activityId={activity.id} onClose={()=>setActionDialog(null)}/>}
          {actionDialog === "share" && <DialogSheet title="Share activity" presentation="dialog" onClose={() => setActionDialog(null)} busy={sharingWithCircle}>
            <div className="space-y-3">
              {SOCIAL_V2_ENABLED ? <button type="button" className="w-full rounded-xl border border-warm-300 p-4 text-left" onClick={()=>setActionDialog('audiences')}>Choose Circle / Communities</button> : <><button type="button" disabled={!showShareWithCircle || sharingWithCircle || sharedWithCircle} className="w-full rounded-xl border border-warm-300 p-4 text-left disabled:opacity-50" onClick={() => { setActionDialog(null); onShareWithCircle?.(activity); }}>
                {sharedWithCircle ? "Already shared with Circle" : "Share with Circle"}
              </button>
              {!showShareWithCircle && <p className="text-sm text-gray-500">Circle sharing disabled. You don’t have any Circle connections.</p>}</>}
              <button type="button" className="w-full rounded-xl border border-warm-300 p-4 text-left" onClick={() => { setActionDialog(null); onShareImage?.(activity); }}>Share other<span className="block text-sm text-gray-500 mt-1">Create an image to save or share with other apps.</span></button>
              <p className="text-sm text-gray-500">Personal notes stay private.</p>
            </div>
          </DialogSheet>}
        </div>}

        <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 px-5">
          <TypeIcon size={24} strokeWidth={1.8} />
          <span className="font-semibold text-gray-900 text-base md:text-lg leading-tight">
            {activity.title || typeConfig.label}
          </span>
        </div>

        {stravaSportLabel && <div className="text-xs text-gray-500 mb-1">{stravaSportLabel}</div>}
        {importedSource && (
          <div className="mb-1 flex items-center justify-center gap-1.5 text-xs text-gray-600">
            <ActivitySourceMark source={importedSource} />
            {needsImportedEnrichment(activity) && <span aria-hidden="true">·</span>}
            {needsImportedEnrichment(activity) && <span>Add details</span>}
          </div>
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

            {thumbUrl && <ActivityPhotoPreview src={thumbUrl} count={photoCount} loading={imageLoading}
              onOpen={() => onOpenGallery(activity)} onLoad={(width, height) => onNoteImageLoad(activity.id, width, height)}/>}

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
