import { useCallback, useEffect, useState } from "react";
import CircleFeedCard from "../components/CircleFeedCard";
import GalleryLightbox from "../components/GalleryLightbox";
import { useGalleryLightbox } from "../hooks/useGalleryLightbox";
import { useCircleFeed } from "../hooks/useCircleFeed";
import { useCircleFeedMedia } from "../hooks/useCircleFeedMedia";
import type { CircleReactionType } from "../lib/circleReactions";
import { buildCircleGalleryItems } from "../lib/circleFeed";
import { getCurrentUser } from "../services/auth.service";
import {
  removeCircleActivityReaction,
  upsertCircleActivityReaction,
  type CircleFeedItem,
} from "../services/circle.service";
import { NOTE_STORAGE_BUCKET } from "../services/storage.service";

export default function CirclePage() {
  const gallery = useGalleryLightbox(NOTE_STORAGE_BUCKET);
  const [userId, setUserId] = useState<string | null>(null);
  const {
    loading,
    loadingMore,
    error,
    feed,
    hasMore,
    circleAccess,
    emptyState,
    refresh,
    loadMore,
  } = useCircleFeed(userId);
  const {
    signedCoverByRecipient,
    signedAvatars,
    coverOrientationByRecipient,
    onCoverLoad,
  } = useCircleFeedMedia(feed);
  const [reactionSavingForShareId, setReactionSavingForShareId] = useState<
    string | null
  >(null);
  const [reactionError, setReactionError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);
    };
    void load();
  }, []);

  const handleToggleReaction = useCallback(
    async (item: CircleFeedItem, reactionType: CircleReactionType) => {
      if (!userId) return;
      if (item.author_user_id === userId) return;

      setReactionError(null);
      setReactionSavingForShareId(item.activity_share_id);

      try {
        if (item.current_user_reaction === reactionType) {
          await removeCircleActivityReaction({
            activityShareId: item.activity_share_id,
            userId,
          });
        } else {
          await upsertCircleActivityReaction({
            activityShareId: item.activity_share_id,
            userId,
            reactionType,
          });
        }
        void refresh();
      } catch (err: any) {
        setReactionError(err?.message || "Could not save reaction.");
        throw err;
      } finally {
        setReactionSavingForShareId(null);
      }
    },
    [refresh, userId]
  );

  return (
    <div className="p-2">
      <h1 className="text-2xl font-semibold mb-4 text-gray-800">Circle</h1>
      <p className="text-sm text-gray-500 mb-4">
        A quiet stream of shared movement summaries.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
          {error}
        </div>
      )}
      {reactionError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
          {reactionError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading Circle…</p>
      ) : !circleAccess ? (
        <div className="rounded-xl border border-warm-200 bg-warm-100 p-4 text-sm text-gray-600">
          Circle is optional. Once you have a pending or accepted connection, this tab will be active.
        </div>
      ) : feed.length === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-warm-100 p-4 text-sm text-gray-600">
          {emptyState}
        </div>
      ) : (
        <div className="space-y-3">
          {feed.map((item) => {
            const thumbUrl = signedCoverByRecipient[item.recipient_id] || null;
            const avatarPath =
              item.author_profile_thumb_path || item.author_profile_image_path;
            const avatarUrl = avatarPath ? signedAvatars[avatarPath] : null;
            return (
              <CircleFeedCard
                key={item.recipient_id}
                item={item}
                thumbUrl={thumbUrl}
                avatarUrl={avatarUrl}
                signedAvatarByPath={signedAvatars}
                coverOrientation={coverOrientationByRecipient[item.recipient_id]}
                onCoverLoad={onCoverLoad}
                onOpenGallery={(row) => {
                  const galleryItems = buildCircleGalleryItems(row);
                  if (galleryItems.length > 0) {
                    gallery.openGallery(galleryItems, 0);
                  }
                }}
                onToggleReaction={handleToggleReaction}
                reactionBusy={reactionSavingForShareId === item.activity_share_id}
                canReact={item.author_user_id !== userId}
              />
            );
          })}

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full rounded-full border border-warm-300 bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}

      <GalleryLightbox
        open={gallery.open}
        items={gallery.items}
        activeIndex={gallery.activeIndex}
        onActiveIndexChange={gallery.setActiveIndex}
        onClose={gallery.closeGallery}
        signedImages={gallery.signedImages}
        signedThumbs={gallery.signedThumbs}
      />
    </div>
  );
}
