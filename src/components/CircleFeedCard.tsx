import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import {
  IconBoxMultiple2,
  IconBoxMultiple3,
  IconBoxMultiple4,
  IconBoxMultiple5,
} from "@tabler/icons-react";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import {
  CIRCLE_REACTION_OPTIONS,
  type CircleReactionType,
  parseCircleReactionGroups,
} from "../lib/circleReactions";
import { parseSharePhotos, parseShareTags } from "../lib/circleFeed";
import type { CircleFeedItem } from "../services/circle.service";
import { formatDurationMinutes } from "../lib/units";

type CircleFeedCardProps = {
  item: CircleFeedItem;
  thumbUrl: string | null;
  avatarUrl: string | null;
  signedAvatarByPath: Record<string, string>;
  coverOrientation: "portrait" | "landscape" | undefined;
  onCoverLoad: (recipientId: string, naturalWidth: number, naturalHeight: number) => void;
  onOpenGallery: (item: CircleFeedItem) => void;
  onToggleReaction: (
    item: CircleFeedItem,
    reactionType: CircleReactionType
  ) => Promise<void>;
  reactionBusy: boolean;
  canReact: boolean;
};

const authorLabel = (authorUserId: string) => `Connection ${authorUserId.slice(0, 8)}`;

export default function CircleFeedCard({
  item,
  thumbUrl,
  avatarUrl,
  signedAvatarByPath,
  coverOrientation,
  onCoverLoad,
  onOpenGallery,
  onToggleReaction,
  reactionBusy,
  canReact,
}: CircleFeedCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactionsInlineOpen, setReactionsInlineOpen] = useState(false);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const reactionToggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const reactionsInlineRef = useRef<HTMLDivElement | null>(null);
  const activityConfig = ACTIVITY_TYPES[item.activity_type] || ACTIVITY_TYPES.other;
  const ActivityIcon = activityConfig.Icon;
  const title = item.title || "Shared activity";
  const photoCount = useMemo(() => parseSharePhotos(item).length, [item]);
  const countIcon = (() => {
    if (photoCount <= 1) return null;
    if (photoCount === 2) return IconBoxMultiple2;
    if (photoCount === 3) return IconBoxMultiple3;
    if (photoCount === 4) return IconBoxMultiple4;
    return IconBoxMultiple5;
  })();
  const tags = useMemo(() => parseShareTags(item), [item]);
  const locationName =
    tags.find((tag) => tag.type === "location")?.value?.trim() || "";
  const otherTagLabel = tags
    .filter((tag) => tag.type !== "location")
    .map((tag) => tag.value.trim())
    .filter(Boolean)
    .join(" · ");
  const reactionGroups = useMemo(
    () => parseCircleReactionGroups(item.reaction_groups),
    [item.reaction_groups]
  );
  const sortedReactors = useMemo(
    () =>
      CIRCLE_REACTION_OPTIONS.flatMap((option) => {
        const actors = reactionGroups[option.type];
        if (!actors?.length) return [];
        return actors.map((actor, indexWithinGroup) => ({
          ...actor,
          reactionType: option.type,
          reactionLabel: option.label,
          reactionOrder: indexWithinGroup,
        }));
      }),
    [reactionGroups]
  );
  const latestReactors = useMemo(
    () =>
      sortedReactors
        .slice()
        .sort((a, b) => {
          const timeA = a.reacted_at ? Date.parse(a.reacted_at) : 0;
          const timeB = b.reacted_at ? Date.parse(b.reacted_at) : 0;
          if (timeA !== timeB) return timeB - timeA;
          return a.reactionOrder - b.reactionOrder;
        }),
    [sortedReactors]
  );
  const reactionOptionByType = useMemo(
    () =>
      Object.fromEntries(
        CIRCLE_REACTION_OPTIONS.map((option) => [option.type, option])
      ) as Record<
        CircleReactionType,
        (typeof CIRCLE_REACTION_OPTIONS)[number]
      >,
    []
  );
  const latestReaction = latestReactors[0] || null;
  const latestReactionOption = latestReaction
    ? reactionOptionByType[latestReaction.reactionType]
    : null;
  const stackPreview = latestReactors.slice(0, 4);
  const stackRemainingCount = Math.max(0, latestReactors.length - 4);
  const canExpandReactions = latestReactors.length > 0;

  useEffect(() => {
    if (!pickerOpen && !reactionsInlineOpen) return;

    const onOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (pickerOpen) {
        if (reactionPickerRef.current?.contains(target)) return;
        if (reactionToggleButtonRef.current?.contains(target)) return;
        setPickerOpen(false);
      }

      if (reactionsInlineOpen) {
        if (reactionsInlineRef.current?.contains(target)) return;
        setReactionsInlineOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideInteraction);
    document.addEventListener("touchstart", onOutsideInteraction);
    return () => {
      document.removeEventListener("mousedown", onOutsideInteraction);
      document.removeEventListener("touchstart", onOutsideInteraction);
    };
  }, [pickerOpen, reactionsInlineOpen]);

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
        {(locationName || otherTagLabel) && (
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-gray-600 flex-wrap">
            {locationName && (
              <span className="inline-flex items-center gap-1 max-w-full">
                <MapPin size={14} strokeWidth={1.8} className="shrink-0" />
                <span>{locationName}</span>
              </span>
            )}
            {locationName && otherTagLabel && (
              <span className="text-gray-400">·</span>
            )}
            {otherTagLabel && <span>{otherTagLabel}</span>}
          </div>
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
            {countIcon && (
              <span className="absolute bottom-2 right-2 rounded-full bg-black/70 text-white text-[11px] font-semibold px-2 py-0.5">
                {(() => {
                  const CountIcon = countIcon;
                  return <CountIcon size={14} strokeWidth={2} />;
                })()}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col items-center gap-2">
        {latestReactors.length > 0 && !reactionsInlineOpen && (
          <div
            className={`inline-flex items-center rounded-full px-1 py-1 ${
              canExpandReactions ? "cursor-pointer" : ""
            }`}
            role={canExpandReactions ? "button" : undefined}
            tabIndex={canExpandReactions ? 0 : undefined}
            onClick={
              canExpandReactions
                ? () => setReactionsInlineOpen((prev) => !prev)
                : undefined
            }
            onKeyDown={
              canExpandReactions
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setReactionsInlineOpen((prev) => !prev);
                    }
                  }
                : undefined
            }
            aria-label={canExpandReactions ? "Show reactions" : undefined}
          >
            <span className="flex items-center">
              {stackPreview.map((actor, index) => {
                const avatarPath = actor.profile_thumb_path || "";
                const avatarUrl = avatarPath ? signedAvatarByPath[avatarPath] : null;
                return avatarUrl ? (
                  <span
                    key={actor.user_id}
                    className={`inline-flex ${index === 0 ? "" : "-ml-2"}`}
                  >
                    <img
                      src={avatarUrl}
                      alt={actor.name}
                      className="h-7 w-7 rounded-full object-cover border-2 border-warm-100 shadow-sm"
                    />
                  </span>
                ) : (
                  <span
                    key={actor.user_id}
                    className={`inline-flex ${index === 0 ? "" : "-ml-2"}`}
                  >
                    <span className="h-7 w-7 rounded-full bg-warm-300 border-2 border-warm-100 text-[11px] font-semibold text-gray-700 flex items-center justify-center shadow-sm">
                      {(actor.name || "M").slice(0, 1).toUpperCase()}
                    </span>
                  </span>
                );
              })}
            </span>
            {stackRemainingCount > 0 && (
              <span className="ml-2 text-xs font-medium text-gray-700">
                +{stackRemainingCount}
              </span>
            )}
            {latestReactionOption && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-700">
                <latestReactionOption.Icon size={14} strokeWidth={1.9} />
                <span className="font-medium">{latestReactionOption.label}</span>
              </span>
            )}
          </div>
        )}
        {canExpandReactions && reactionsInlineOpen && (
          <div
            ref={reactionsInlineRef}
            className="w-full rounded-lg border border-warm-200 bg-warm-50 p-2 space-y-2"
            onClick={() => setReactionsInlineOpen(false)}
          >
            {latestReactors.map((reactor) => {
              const option = reactionOptionByType[reactor.reactionType];
              const avatarPath = reactor.profile_thumb_path || "";
              const reactorAvatarUrl = avatarPath
                ? signedAvatarByPath[avatarPath]
                : null;
              return (
                <div
                  key={`${reactor.user_id}:${reactor.reactionType}:${reactor.reacted_at ?? "na"}`}
                  className="flex items-center justify-center gap-2 text-xs text-gray-700"
                >
                  {reactorAvatarUrl ? (
                    <img
                      src={reactorAvatarUrl}
                      alt={reactor.name}
                      className="h-6 w-6 rounded-full object-cover border border-warm-200"
                    />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-warm-300 border border-warm-200 text-[10px] font-semibold text-gray-700 flex items-center justify-center">
                      {(reactor.name || "M").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <option.Icon size={14} strokeWidth={1.9} />
                  <span className="font-medium">{option.label}</span>
                  <span className="text-gray-500">· {reactor.name}</span>
                </div>
              );
            })}
          </div>
        )}
        {item.has_new_reactions && (
          <p className="text-xs font-medium text-movenotes-primary">• new</p>
        )}

        {canReact && (
          <button
            ref={reactionToggleButtonRef}
            type="button"
            disabled={reactionBusy}
            className="text-xs text-movenotes-primary underline disabled:opacity-60"
            onClick={() => setPickerOpen((prev) => !prev)}
          >
            {reactionBusy ? "Saving..." : "React"}
          </button>
        )}

        {canReact && pickerOpen && (
          <div
            ref={reactionPickerRef}
            className="w-full rounded-xl border border-warm-200 bg-warm-100 p-3"
          >
            <p className="text-sm font-medium text-gray-800 mb-2 text-center">
              Share your reaction
            </p>
            <div className="space-y-2">
              {CIRCLE_REACTION_OPTIONS.map((option) => {
                const isSelected = item.current_user_reaction === option.type;
                return (
                  <button
                    key={option.type}
                    type="button"
                    disabled={reactionBusy}
                    onClick={async () => {
                      try {
                        await onToggleReaction(item, option.type);
                        setPickerOpen(false);
                      } catch {
                        /* keep picker open so user can retry */
                      }
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-left disabled:opacity-60 ${
                      isSelected
                        ? "border-movenotes-primary bg-movenotes-primary/10 text-movenotes-primary"
                        : "border-warm-300 bg-white text-gray-800"
                    }`}
                  >
                    <span className="mr-2 inline-flex align-middle">
                      <option.Icon size={16} strokeWidth={1.9} />
                    </span>
                    <span>{option.label}</span>
                    {isSelected && <span className="ml-2 text-xs">selected</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </article>
  );
}
