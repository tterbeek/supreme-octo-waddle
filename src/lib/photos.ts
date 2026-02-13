import { ACTIVITY_TYPES } from "../config/activityTypes";

export const MAX_ACTIVITY_PHOTOS = 5;

type RawPhoto = {
  id?: string | null;
  image_path?: string | null;
  thumb_path?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  imagePath?: string | null;
  thumbPath?: string | null;
  sortOrder?: number | null;
  createdAt?: string | null;
};

export type ActivityPhoto = {
  id: string;
  image_path: string | null;
  thumb_path: string | null;
  sort_order: number | null;
  created_at: string | null;
};

export type GalleryItem = {
  key: string;
  activity: any;
  imagePath: string | null;
  thumbPath: string | null;
  photoId: string | null;
};

const toActivityPhoto = (photo: RawPhoto, fallbackId: string): ActivityPhoto => ({
  id: String(photo.id ?? fallbackId),
  image_path: photo.image_path ?? photo.imagePath ?? null,
  thumb_path: photo.thumb_path ?? photo.thumbPath ?? null,
  sort_order: photo.sort_order ?? photo.sortOrder ?? null,
  created_at: photo.created_at ?? photo.createdAt ?? null,
});

const comparePhotos = (a: ActivityPhoto, b: ActivityPhoto) => {
  const aOrder = a.sort_order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.sort_order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;

  const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (aCreated !== bCreated) return aCreated - bCreated;

  return a.id.localeCompare(b.id);
};

export const getActivityPhotos = (activity: any): ActivityPhoto[] => {
  const rawPhotos = Array.isArray(activity?.photos) ? activity.photos : [];
  const normalized = rawPhotos.map((photo: RawPhoto, idx: number) =>
    toActivityPhoto(photo, `photo-${idx}`)
  );

  if (normalized.length > 0) {
    return normalized.sort(comparePhotos);
  }

  const legacyImage = activity?.note_image_url || null;
  const legacyThumb = activity?.note_thumb_image_url || null;
  if (!legacyImage && !legacyThumb) return [];

  return [
    {
      id: `legacy-${activity?.id ?? "activity"}`,
      image_path: legacyImage,
      thumb_path: legacyThumb,
      sort_order: null,
      created_at: activity?.created_at ?? null,
    },
  ];
};

export const buildGalleryItemsForActivity = (activity: any): GalleryItem[] => {
  const photos = getActivityPhotos(activity);
  return photos.map((photo) => ({
    key: `${activity?.id ?? "activity"}:${photo.id}`,
    activity,
    imagePath: photo.image_path,
    thumbPath: photo.thumb_path,
    photoId: photo.id,
  }));
};

export const buildGalleryItemsForActivities = (activities: any[]): GalleryItem[] => {
  const items: GalleryItem[] = [];
  activities.forEach((activity) => {
    const activityItems = buildGalleryItemsForActivity(activity);
    activityItems.forEach((item) => items.push(item));
  });
  return items;
};

export const getActivityDateValue = (activity: any) => {
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

export const formatActivityMeta = (activity: any) => {
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

export const getActivityNoteText = (activity: any) => {
  const note =
    activity?.notes ||
    activity?.entry_text ||
    activity?.text ||
    activity?.journal_entry ||
    "";
  if (typeof note !== "string") return "";
  return note.trim();
};
