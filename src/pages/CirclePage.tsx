import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCircleConnectionState,
  getCircleFeed,
  hasCircleAccess,
  markCircleFeedItemSeen,
  type CircleFeedItem,
} from "../services/circle.service";
import { supabase } from "../supabaseClient";
import { getCurrentUser } from "../services/auth.service";
import { createSignedUrls } from "../services/storage.service";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import GalleryLightbox from "../components/GalleryLightbox";
import { useGalleryLightbox } from "../hooks/useGalleryLightbox";
import type { GalleryItem } from "../lib/photos";

const NOTE_BUCKET = "actvity-notes";
const LEGACY_NOTE_BUCKET = "activity-notes";
const PAGE_SIZE = 30;

const authorLabel = (authorUserId: string) => `Connection ${authorUserId.slice(0, 8)}`;

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeStoragePath = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutQuery = trimmed.split("?")[0].split("#")[0];
  if (!withoutQuery.startsWith("http")) {
    const decoded = safeDecode(withoutQuery).replace(/^\/+/, "");
    if (decoded.startsWith(`${NOTE_BUCKET}/`)) return decoded.slice(NOTE_BUCKET.length + 1);
    if (decoded.startsWith(`${LEGACY_NOTE_BUCKET}/`)) {
      return decoded.slice(LEGACY_NOTE_BUCKET.length + 1);
    }
    return decoded;
  }

  try {
    const url = new URL(withoutQuery);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+)$/);
    if (!match?.[2]) return null;
    const bucket = match[1];
    if (bucket !== NOTE_BUCKET && bucket !== LEGACY_NOTE_BUCKET) return null;
    return safeDecode(match[2]).replace(/^\/+/, "");
  } catch {
    return null;
  }
};

type CirclePhoto = {
  image_path?: string | null;
  thumb_path?: string | null;
  sort_order?: number | null;
};

const getSharePhotos = (row: CircleFeedItem): CirclePhoto[] => {
  const parsed = (() => {
    if (Array.isArray(row.photos)) return row.photos;
    if (typeof row.photos === "string") {
      try {
        const data = JSON.parse(row.photos);
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  const normalized = parsed
    .map((photo) => ({
      image_path: photo?.image_path || null,
      thumb_path: photo?.thumb_path || null,
      sort_order: photo?.sort_order ?? null,
    }))
    .filter((photo) => photo.image_path || photo.thumb_path);

  if (normalized.length > 0) {
    return normalized.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  if (row.shared_photo_url || row.shared_thumb_photo_url) {
    return [
      {
        image_path: row.shared_photo_url || null,
        thumb_path: row.shared_thumb_photo_url || null,
        sort_order: 0,
      },
    ];
  }

  return [];
};

const getPreferredCoverPath = (row: CircleFeedItem): string | null => {
  const first = getSharePhotos(row)[0];
  return (
    first?.thumb_path ||
    first?.image_path ||
    row.shared_thumb_photo_url ||
    row.shared_photo_url ||
    null
  );
};

export default function CirclePage() {
  const gallery = useGalleryLightbox(NOTE_BUCKET);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<CircleFeedItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [circleAccess, setCircleAccess] = useState(false);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [signedCoverByRecipient, setSignedCoverByRecipient] = useState<Record<string, string>>(
    {}
  );
  const [signedAvatars, setSignedAvatars] = useState<Record<string, string>>({});
  const [coverOrientationByRecipient, setCoverOrientationByRecipient] = useState<
    Record<string, "portrait" | "landscape">
  >({});

  const signAssets = useCallback(async (rows: CircleFeedItem[]) => {
    const coverPathByRecipient: Record<string, string> = {};
    for (const row of rows) {
      const coverPath = getPreferredCoverPath(row);
      if (coverPath) {
        coverPathByRecipient[row.recipient_id] = coverPath;
      }
    }

    const missingShareIds = Array.from(
      new Set(
        rows
          .filter((row) => !coverPathByRecipient[row.recipient_id])
          .map((row) => row.activity_share_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    if (missingShareIds.length) {
      const { data, error } = await supabase
        .from("activity_share_photos")
        .select("activity_share_id, image_path, thumb_path, sort_order, created_at, id")
        .in("activity_share_id", missingShareIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        console.warn("[Circle] Could not load activity_share_photos fallback:", error.message);
      }

      const allByShare: Record<string, string[]> = {};
      for (const photo of data || []) {
        const list = (allByShare[photo.activity_share_id] ||= []);
        if (photo.thumb_path) list.push(photo.thumb_path);
        if (photo.image_path) list.push(photo.image_path);
      }

      for (const row of rows) {
        if (!coverPathByRecipient[row.recipient_id]) {
          const fallback = allByShare[row.activity_share_id];
          if (fallback?.length) coverPathByRecipient[row.recipient_id] = fallback[0];
        }
      }
    }

    const photoRaw = Array.from(new Set(Object.values(coverPathByRecipient)));
    const avatarRaw = Array.from(
      new Set(
        rows
          .map((row) => row.author_profile_thumb_path || row.author_profile_image_path)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    const photoPathPairs = photoRaw
      .map((raw) => ({ raw, path: normalizeStoragePath(raw) }))
      .filter((item): item is { raw: string; path: string } => Boolean(item.path));
    const avatarPathPairs = avatarRaw
      .map((raw) => ({ raw, path: normalizeStoragePath(raw) }))
      .filter((item): item is { raw: string; path: string } => Boolean(item.path));

    const photoDirect = photoRaw
      .filter((raw) => raw.startsWith("http") && !normalizeStoragePath(raw))
      .reduce<Record<string, string>>((acc, raw) => {
        acc[raw] = raw;
        return acc;
      }, {});
    const avatarDirect = avatarRaw
      .filter((raw) => raw.startsWith("http") && !normalizeStoragePath(raw))
      .reduce<Record<string, string>>((acc, raw) => {
        acc[raw] = raw;
        return acc;
      }, {});

    const photoSignedByRaw: Record<string, string> = { ...photoDirect };
    if (photoPathPairs.length) {
      const uniquePaths = Array.from(new Set(photoPathPairs.map((p) => p.path)));
      const signedByPath = await createSignedUrls(NOTE_BUCKET, uniquePaths);
      const unresolvedPaths = uniquePaths.filter((path) => !signedByPath[path]);
      if (unresolvedPaths.length) {
        const legacySigned = await createSignedUrls(LEGACY_NOTE_BUCKET, unresolvedPaths);
        for (const [path, url] of Object.entries(legacySigned)) {
          if (url) signedByPath[path] = url;
        }
      }
      for (const pair of photoPathPairs) {
        const signed = signedByPath[pair.path];
        if (signed) {
          photoSignedByRaw[pair.raw] = signed;
        } else if (pair.raw.startsWith("http")) {
          photoSignedByRaw[pair.raw] = pair.raw;
        }
      }
    }
    const signedByRecipient: Record<string, string> = {};
    for (const [recipientId, rawPath] of Object.entries(coverPathByRecipient)) {
      const signed = photoSignedByRaw[rawPath];
      if (signed) {
        signedByRecipient[recipientId] = signed;
      }
    }
    setSignedCoverByRecipient(signedByRecipient);

    const avatarSignedByRaw: Record<string, string> = { ...avatarDirect };
    if (avatarPathPairs.length) {
      const uniquePaths = Array.from(new Set(avatarPathPairs.map((p) => p.path)));
      const signedByPath = await createSignedUrls(
        NOTE_BUCKET,
        uniquePaths
      );
      const unresolvedPaths = uniquePaths.filter((path) => !signedByPath[path]);
      if (unresolvedPaths.length) {
        const legacySigned = await createSignedUrls(LEGACY_NOTE_BUCKET, unresolvedPaths);
        for (const [path, url] of Object.entries(legacySigned)) {
          if (url) signedByPath[path] = url;
        }
      }
      for (const pair of avatarPathPairs) {
        const signed = signedByPath[pair.path];
        if (signed) {
          avatarSignedByRaw[pair.raw] = signed;
        } else if (pair.raw.startsWith("http")) {
          avatarSignedByRaw[pair.raw] = pair.raw;
        }
      }
    }
    setSignedAvatars(avatarSignedByRaw);
  }, []);

  const markUnseenAsSeen = useCallback(async (uid: string, rows: CircleFeedItem[]) => {
    const unseen = rows.filter((row) => !row.seen_at).map((row) => row.recipient_id);
    if (!unseen.length) return;

    await Promise.allSettled(
      unseen.map((recipientId) => markCircleFeedItemSeen(recipientId, uid))
    );

    setFeed((prev) =>
      prev.map((row) =>
        unseen.includes(row.recipient_id) && !row.seen_at
          ? { ...row, seen_at: new Date().toISOString() }
          : row
      )
    );
  }, []);

  const loadInitial = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [access, connectionState, rows] = await Promise.all([
        hasCircleAccess(uid),
        fetchCircleConnectionState(uid),
        getCircleFeed({ userId: uid, limit: PAGE_SIZE }),
      ]);
      setCircleAccess(access);
      setAcceptedCount(connectionState.acceptedCount);
      setPendingCount(connectionState.pendingCount);
      setFeed(rows);
      setHasMore(rows.length === PAGE_SIZE);
      await signAssets(rows);
      void markUnseenAsSeen(uid, rows);
    } catch (err: any) {
      setError(err?.message || "Could not load Circle feed.");
    } finally {
      setLoading(false);
    }
  }, [markUnseenAsSeen, signAssets]);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      await loadInitial(user.id);
    };
    void load();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || loadingMore || feed.length === 0) return;
    setLoadingMore(true);
    setError(null);
    try {
      const last = feed[feed.length - 1];
      const rows = await getCircleFeed({
        userId,
        limit: PAGE_SIZE,
        beforeOccurredOn: last.occurred_on,
        beforeSharedAt: last.shared_at,
        beforeRecipientId: last.recipient_id,
      });
      if (!rows.length) {
        setHasMore(false);
        return;
      }
      setFeed((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      await signAssets([...feed, ...rows]);
      void markUnseenAsSeen(userId, rows);
    } catch (err: any) {
      setError(err?.message || "Could not load more Circle items.");
    } finally {
      setLoadingMore(false);
    }
  }, [feed, hasMore, loadingMore, markUnseenAsSeen, signAssets, userId]);

  const emptyState = useMemo(() => {
    if (acceptedCount === 0 && pendingCount > 0) {
      return "You have pending Circle requests. Accepted connections can share summaries here.";
    }
    return "Nothing shared yet. When people in your circle share a movement summary, it will appear here.";
  }, [acceptedCount, pendingCount]);

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
            const activityConfig = ACTIVITY_TYPES[item.activity_type] || ACTIVITY_TYPES.other;
            const ActivityIcon = activityConfig.Icon;
            const title = item.title || "Shared activity";
            return (
              <article
                key={item.recipient_id}
                className="rounded-xl border border-warm-200 bg-warm-100 p-4"
              >
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
                    <span>
                      {new Date(item.occurred_on).toLocaleDateString("en-GB")}
                    </span>
                    <span>·</span>
                    <span className="break-words">
                      {title}
                    </span>
                  </div>
                  {(item.distance_km != null || item.duration_min != null) && (
                    <p className="mt-2 text-sm text-gray-600">
                      {item.distance_km != null
                        ? `${Number(item.distance_km).toFixed(0)} km`
                        : null}
                      {item.distance_km != null && item.duration_min != null ? " · " : ""}
                      {item.duration_min != null
                        ? `${Number(item.duration_min).toFixed(0)} min`
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
                        const photos = getSharePhotos(item);
                        const galleryItems: GalleryItem[] = photos.flatMap((photo, idx) => {
                            const normalizedImage = photo.image_path
                              ? normalizeStoragePath(photo.image_path)
                              : null;
                            const normalizedThumb = photo.thumb_path
                              ? normalizeStoragePath(photo.thumb_path)
                              : null;
                            const imagePath = normalizedImage || normalizedThumb || null;
                            const thumbPath = normalizedThumb || normalizedImage || null;
                            if (!imagePath && !thumbPath) return [];
                            return [
                              {
                                key: `${item.activity_share_id}:${idx}`,
                                activity: {
                                  id: item.activity_share_id,
                                  date: item.occurred_on,
                                  title: item.title || "Shared activity",
                                  type: item.activity_type,
                                  notes: null,
                                },
                                imagePath,
                                thumbPath,
                                photoId: `${idx}`,
                              },
                            ];
                          });
                        if (galleryItems.length > 0) {
                          gallery.openGallery(galleryItems, 0);
                        }
                      }}
                    >
                      <img
                        src={thumbUrl}
                        alt={title}
                        className={`
                          rounded-xl border border-warm-200 shadow-sm
                          ${
                            coverOrientationByRecipient[item.recipient_id] === "portrait"
                              ? "max-h-60 w-auto max-w-full mx-auto object-contain"
                              : "w-full max-h-56 object-cover"
                          }
                        `}
                        loading="lazy"
                        onLoad={(event) => {
                          const { naturalWidth, naturalHeight } = event.currentTarget;
                          setCoverOrientationByRecipient((prev) => ({
                            ...prev,
                            [item.recipient_id]:
                              naturalHeight > naturalWidth ? "portrait" : "landscape",
                          }));
                        }}
                      />
                    </button>
                  </div>
                )}
              </article>
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
