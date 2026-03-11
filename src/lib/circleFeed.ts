import type { CircleFeedItem } from "../services/circle.service";
import { normalizeStoragePath } from "../services/storage.service";
import type { GalleryItem } from "./photos";

type CirclePhoto = {
  image_path?: string | null;
  thumb_path?: string | null;
  sort_order?: number | null;
};

export const parseSharePhotos = (row: CircleFeedItem): CirclePhoto[] => {
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

export const getPreferredCoverPath = (row: CircleFeedItem): string | null => {
  const first = parseSharePhotos(row)[0];
  return (
    first?.thumb_path ||
    first?.image_path ||
    row.shared_thumb_photo_url ||
    row.shared_photo_url ||
    null
  );
};

export const buildCircleGalleryItems = (row: CircleFeedItem): GalleryItem[] => {
  const photos = parseSharePhotos(row);
  return photos.flatMap((photo, idx) => {
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
        key: `${row.activity_share_id}:${idx}`,
        activity: {
          id: row.activity_share_id,
          date: row.occurred_on,
          title: row.title || "Shared activity",
          type: row.activity_type,
          notes: null,
        },
        imagePath,
        thumbPath,
        photoId: `${idx}`,
      },
    ];
  });
};
