import RecentActivityCard from "./RecentActivityCard";
import type { UnitSystem } from "../lib/units";

type RecentActivityListProps = {
  activities: any[];
  signedNoteImages: Record<string, string>;
  signedNoteThumbs: Record<string, string>;
  noteImageOrientation: Record<string, "portrait" | "landscape">;
  setNoteImageOrientation: React.Dispatch<
    React.SetStateAction<Record<string, "portrait" | "landscape">>
  >;
  unitSystem: UnitSystem;
  lightboxOpen: boolean;
  tooltipVisibleIndex: number | null;
  onTooltipClose: () => void;
  onEdit: (activity: any) => void;
  onImageClick: (e: React.MouseEvent<HTMLImageElement>, url: string, activity: any) => void;
  onImageTouchStart: (e: React.TouchEvent<HTMLImageElement>) => void;
  onImageTouchMove: (e: React.TouchEvent<HTMLImageElement>) => void;
  onImageTouchEnd: (
    e: React.TouchEvent<HTMLImageElement>,
    url: string,
    activity: any
  ) => void;
};

export default function RecentActivityList({
  activities,
  signedNoteImages,
  signedNoteThumbs,
  noteImageOrientation,
  setNoteImageOrientation,
  unitSystem,
  lightboxOpen,
  tooltipVisibleIndex,
  onTooltipClose,
  onEdit,
  onImageClick,
  onImageTouchStart,
  onImageTouchMove,
  onImageTouchEnd,
}: RecentActivityListProps) {
  return (
    <div className="flex flex-col gap-3 mt-2">
      {activities.map((a, idx) => {
        const showAfterLogTooltip = tooltipVisibleIndex === idx;
        return (
          <RecentActivityCard
            key={a.id}
            activity={a}
            signedNoteImages={signedNoteImages}
            signedNoteThumbs={signedNoteThumbs}
            noteImageOrientation={noteImageOrientation}
            onEdit={(activity) => onEdit(activity)}
            onNoteImageLoad={(activityId, naturalWidth, naturalHeight) => {
              setNoteImageOrientation((prev) => ({
                ...prev,
                [activityId]:
                  naturalHeight > naturalWidth ? "portrait" : "landscape",
              }));
            }}
            unitSystem={unitSystem}
            tooltipVisible={showAfterLogTooltip}
            onTooltipClose={onTooltipClose}
            onImageClick={onImageClick}
            onImageTouchStart={onImageTouchStart}
            onImageTouchMove={onImageTouchMove}
            onImageTouchEnd={onImageTouchEnd}
            disableSwipe={lightboxOpen}
          />
        );
      })}
    </div>
  );
}
