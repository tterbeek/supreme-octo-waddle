import { useEffect, useState } from "react";
import { Frown, Laugh, Meh, Smile, Zap } from "lucide-react";
import SwipeActions from "./SwipeActions";
import TooltipBubble from "./TooltipBubble";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { formatDistance, type UnitSystem } from "../lib/units";
import { getActivityPhotos } from "../lib/photos";

type RecentActivityCardProps = {
  activity: any;
  signedNoteImages: Record<string, string>;
  signedNoteThumbs: Record<string, string>;
  noteImageOrientation: Record<string, "portrait" | "landscape">;
  onEdit: (activity: any) => void;
  onNoteImageLoad: (activityId: string, naturalWidth: number, naturalHeight: number) => void;
  unitSystem: UnitSystem;
  tooltipVisible: boolean;
  onTooltipClose: () => void;
  onOpenGallery: (activity: any) => void;
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
  onTooltipClose,
  onOpenGallery,
  disableSwipe = false,
}: RecentActivityCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
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
    if (!first?.name) return "";
    const maxLen = 26;
    return first.name.length > maxLen
      ? `${first.name.slice(0, maxLen - 3)}...`
      : first.name;
  })();
  const thumbUrl = signedNoteThumbs[activity.id] || signedNoteImages[activity.id];
  const fullUrl = signedNoteImages[activity.id] || thumbUrl;
  const photoCount = getActivityPhotos(activity).length;

  useEffect(() => {
    setImageLoaded(false);
  }, [thumbUrl]);

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
          const target = e.target as HTMLElement | null;
          if (target?.closest?.("[data-photo-trigger]")) return;
          onEdit(activity);
        }}
      >
        {tooltipVisible && (
          <TooltipBubble position="top" onClose={onTooltipClose}>
            Create a preset to make logging this activity faster next time.
          </TooltipBubble>
        )}

        <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
          <TypeIcon size={24} strokeWidth={1.8} />
          <span className="font-semibold text-gray-900 text-base md:text-lg leading-tight">
            {activity.title || typeConfig.label}
          </span>
        </div>

        <div className="text-sm md:text-base text-gray-700 flex items-center justify-center gap-2 mb-1 flex-wrap">
          {formattedDistance && (
            <>
              <span>{formattedDistance}</span>
              <span className="text-gray-400">·</span>
            </>
          )}
          {activity.duration_min != null && (
            <>
              <span>{activity.duration_min} min</span>
              <span className="text-gray-400">·</span>
            </>
          )}
          {equipmentName && <span className="text-gray-600">{equipmentName}</span>}
        </div>

        <div className="flex items-center justify-center gap-3 my-3">
          {(() => {
            const f = Number(activity.feeling) || 0;
            const base = "w-5 h-5 md:w-6 md:h-6";
            if (f <= 1)
              return (
                <Frown className={`${base} text-movenotes-accent`} />
              );
            if (f === 2)
              return <Meh className={`${base} text-movenotes-accent`} />;
            if (f === 3)
              return (
                <Smile className={`${base} text-movenotes-accent`} />
              );
            if (f >= 4)
              return (
                <Laugh className={`${base} text-movenotes-accent`} />
              );
            return null;
          })()}

          <div className="flex items-center gap-1 md:gap-1.5">
            {Array.from({ length: Number(activity.effort) || 0 }).map(
              (_, i) => (
                <Zap
                  key={i}
                  className="w-4 h-4 md:w-5 md:h-5 text-movenotes-accent"
                />
              )
            )}
          </div>
        </div>

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
              <div className="relative inline-block" data-photo-trigger="true">
                <img
                  src={thumbUrl}
                  alt="Activity note"
                  loading="lazy"
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
                    if (photoCount > 0) onOpenGallery(activity);
                  }}
                  onLoad={(e) => {
                    const { naturalWidth, naturalHeight } = e.currentTarget;
                    onNoteImageLoad(activity.id, naturalWidth, naturalHeight);
                    setImageLoaded(true);
                  }}
                />
                {photoCount > 1 && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/70 text-white text-[11px] font-semibold px-2 py-0.5">
                    {photoCount}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </SwipeActions>
  );
}
