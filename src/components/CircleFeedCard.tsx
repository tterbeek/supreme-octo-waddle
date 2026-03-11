import { ACTIVITY_TYPES } from "../config/activityTypes";
import type { CircleFeedItem } from "../services/circle.service";
import { formatDurationMinutes } from "../lib/units";

type CircleFeedCardProps = {
  item: CircleFeedItem;
  thumbUrl: string | null;
  avatarUrl: string | null;
  coverOrientation: "portrait" | "landscape" | undefined;
  onCoverLoad: (recipientId: string, naturalWidth: number, naturalHeight: number) => void;
  onOpenGallery: (item: CircleFeedItem) => void;
};

const authorLabel = (authorUserId: string) => `Connection ${authorUserId.slice(0, 8)}`;

export default function CircleFeedCard({
  item,
  thumbUrl,
  avatarUrl,
  coverOrientation,
  onCoverLoad,
  onOpenGallery,
}: CircleFeedCardProps) {
  const activityConfig = ACTIVITY_TYPES[item.activity_type] || ACTIVITY_TYPES.other;
  const ActivityIcon = activityConfig.Icon;
  const title = item.title || "Shared activity";

  return (
    <article className="rounded-xl border border-warm-200 bg-warm-100 p-4">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center justify-center gap-2 flex-wrap text-sm font-semibold text-gray-900">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={item.author_display_name || "Author profile"}
              className="h-8 w-8 rounded-full object-cover border border-warm-300"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-warm-300 text-gray-700 border border-warm-300 flex items-center justify-center text-xs font-semibold">
              {(item.author_display_name || authorLabel(item.author_user_id))
                .slice(0, 1)
                .toUpperCase()}
            </div>
          )}
          <span>·</span>
          <div className="text-gray-900" aria-label={activityConfig.label}>
            <ActivityIcon size={18} strokeWidth={1.8} />
          </div>
          <span>·</span>
          <span>{new Date(item.occurred_on).toLocaleDateString("en-GB")}</span>
          <span>·</span>
          <span className="break-words">{title}</span>
        </div>
        {(item.distance_km != null || item.duration_min != null) && (
          <p className="mt-2 text-sm text-gray-600">
            {item.distance_km != null ? `${Number(item.distance_km).toFixed(0)} km` : null}
            {item.distance_km != null && item.duration_min != null ? " · " : ""}
            {item.duration_min != null
              ? formatDurationMinutes(Number(item.duration_min))
              : null}
          </p>
        )}
      </div>

      {thumbUrl && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            className="relative inline-block"
            onClick={(event) => {
              event.stopPropagation();
              onOpenGallery(item);
            }}
          >
            <img
              src={thumbUrl}
              alt={title}
              className={`
                rounded-xl border border-warm-200 shadow-sm
                ${
                  coverOrientation === "portrait"
                    ? "max-h-60 w-auto max-w-full mx-auto object-contain"
                    : "w-full max-h-56 object-cover"
                }
              `}
              loading="lazy"
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                onCoverLoad(item.recipient_id, naturalWidth, naturalHeight);
              }}
            />
          </button>
        </div>
      )}
    </article>
  );
}
