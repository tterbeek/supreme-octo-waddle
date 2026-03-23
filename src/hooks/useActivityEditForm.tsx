import { useEffect, useRef, useState, type TouchEvent } from "react";
import {
  resolveActivityFields,
  type ActivityPreference,
} from "../lib/resolveActivityFields";
import { resolveEditFields } from "../lib/resolveEditActivityFields";
import { kmToMiles, milesToKm, roundDurationMinutes } from "../lib/units";
import { extractPhotoGps } from "../lib/exifGps";
import { getActivityPhotos, MAX_ACTIVITY_PHOTOS } from "../lib/photos";
import { getCurrentUser } from "../services/auth.service";
import { fetchActivityPreference } from "../services/quickLog.service";
import {
  compressImage,
  createThumbnail,
  uploadActivityImage,
  deleteActivityImages,
} from "../services/activityMedia.service";
import {
  deleteActivityPhotosByActivity,
  insertActivityPhotos,
} from "../services/activityPhotos.service";
import { resolveActivityLocationTag } from "../services/activityLocation.service";
import { updateActivity, deleteActivity } from "../services/activity.service";
import {
  createEquipment,
  fetchActiveEquipment,
  fetchEquipmentForActivity,
  replaceActivityEquipment,
} from "../services/equipment.service";
import type { Equipment } from "../types";

type UseActivityEditFormArgs = {
  activity: any;
  unitSystem: string;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
};

export function useActivityEditForm({
  activity,
  unitSystem,
  onClose,
  onUpdated,
  onDeleted,
}: UseActivityEditFormArgs) {
  const [title, setTitle] = useState(activity.title || "");
  const [distanceKm, setDistanceKm] = useState<number | null>(activity.distance_km ?? null);
  const activityType = activity.type;
  const [preference, setPreference] = useState<ActivityPreference | undefined>();
  const baseFields = resolveActivityFields(activityType, preference);
  const { defaultFields, optionalFields } = resolveEditFields(baseFields, activity);
  const [showOptionalDistance, setShowOptionalDistance] = useState(
    activity.distance_km != null
  );
  const [duration, setDuration] = useState(
    activity.duration_min != null
      ? String(roundDurationMinutes(Number(activity.duration_min)))
      : ""
  );
  const [showOptionalDuration, setShowOptionalDuration] = useState(
    activity.duration_min != null
  );
  const [date, setDate] = useState(activity.date || "");
  const [rating, setRating] = useState(activity.feeling || 3);
  const [effort, setEffort] = useState<number | null>(
    activity.effort == null ? null : Number(activity.effort)
  );
  const [note, setNote] = useState(activity.notes || "");
  const [noteImageUrl, setNoteImageUrl] = useState(activity.note_image_url || null);
  const [noteThumbImageUrl, setNoteThumbImageUrl] = useState(activity.note_thumb_image_url || null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removeExistingPhotos, setRemoveExistingPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const startY = useRef<number | null>(null);
  const openedAtRef = useRef<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const existingPhotos = getActivityPhotos(activity);
  const existingPhotoTotal = existingPhotos.length;
  const existingPhotoCount = removeExistingPhotos ? 0 : existingPhotoTotal;

  const distanceDisplay =
    distanceKm == null
      ? ""
      : unitSystem === "imperial"
      ? String(Math.round(kmToMiles(distanceKm) * 100) / 100)
      : String(distanceKm);

  const ensureUserId = async () => {
    if (userId) return userId;
    const user = await getCurrentUser();
    if (!user) return null;
    setUserId(user.id);
    return user.id;
  };

  const handleDistanceChange = (value: string) => {
    if (value === "") {
      setDistanceKm(null);
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    const kmValue = unitSystem === "imperial" ? milesToKm(numeric) : numeric;
    setDistanceKm(kmValue);
  };

  useEffect(() => {
    openedAtRef.current = Date.now();
    setAnimateIn(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setShowOptionalDistance(activity.distance_km != null);
    setShowOptionalDuration(activity.duration_min != null);
    setEquipment([]);
    setSelectedEquipmentIds([]);
    setSelectedFiles([]);
    setRemoveExistingPhotos(false);
    setUploadError(null);

    const loadPreference = async () => {
      setPreference(undefined);

      const currentUserId = await ensureUserId();

      if (!currentUserId || cancelled) return;

      if (activityType !== "restore") {
        const pref = await fetchActivityPreference(currentUserId, activityType);
        if (!cancelled) {
          setPreference(pref);
        }
      }

      const [equipmentList, activityEquipment] = await Promise.all([
        fetchActiveEquipment(currentUserId),
        fetchEquipmentForActivity(activity.id),
      ]);

      if (cancelled) return;

      const mergedEquipment: Equipment[] = [...equipmentList];
      activityEquipment.forEach((item) => {
        if (!mergedEquipment.find((eq) => eq.id === item.id)) {
          mergedEquipment.push(item);
        }
      });

      setEquipment(mergedEquipment);
      setSelectedEquipmentIds(activityEquipment.map((item) => item.id));
    };

    loadPreference();

    return () => {
      cancelled = true;
    };
  }, [activity.id, activityType]);

  const appendFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const available = MAX_ACTIVITY_PHOTOS - existingPhotoCount - selectedFiles.length;
    if (available <= 0) {
      setUploadError(`You can attach up to ${MAX_ACTIVITY_PHOTOS} photos.`);
      return;
    }

    const next = [...selectedFiles, ...incoming.slice(0, available)];
    if (incoming.length > available) {
      setUploadError(`You can attach up to ${MAX_ACTIVITY_PHOTOS} photos.`);
    } else {
      setUploadError(null);
    }
    setSelectedFiles(next);
    setUploadProgress(0);
  };

  const handleSave = async () => {
    setSaving(true);
    setUploadError(null);
    const existingCover =
      !removeExistingPhotos && existingPhotos.length > 0 ? existingPhotos[0] : null;
    let imageUrl = removeExistingPhotos
      ? null
      : existingCover?.image_path ?? noteImageUrl;
    let thumbUrl = removeExistingPhotos
      ? null
      : existingCover?.thumb_path ?? noteThumbImageUrl;
    const deletePaths: string[] = [];

    const distanceValue =
      (defaultFields.includes("distance_km") || showOptionalDistance) && distanceKm != null
        ? distanceKm
        : null;

    const durationValue =
      (defaultFields.includes("duration_min") || showOptionalDuration) && duration
        ? roundDurationMinutes(Number(duration))
        : null;

    const effortValue =
      ["run", "ride", "swim", "hike"].includes(activityType)
        ? Number(effort) || null
        : null;

    const feelingValue = Number(rating) || null;

    try {
      if (existingPhotoCount + selectedFiles.length > MAX_ACTIVITY_PHOTOS) {
        setUploadError(`You can attach up to ${MAX_ACTIVITY_PHOTOS} photos total.`);
        setSaving(false);
        return;
      }

      if (removeExistingPhotos && existingPhotos.length > 0) {
        const { data, error } = await deleteActivityPhotosByActivity(activity.id);
        if (error) throw error;
        data.forEach((row) => {
          if (row.image_path) deletePaths.push(row.image_path);
          if (row.thumb_path) deletePaths.push(row.thumb_path);
        });
        if (activity.note_image_url) deletePaths.push(activity.note_image_url);
        if (activity.note_thumb_image_url) deletePaths.push(activity.note_thumb_image_url);
      }

      if (selectedFiles.length > 0) {
        setUploading(true);
        const totalSteps = selectedFiles.length * 3 + 1;
        let step = 0;
        const bump = () => {
          step += 1;
          setUploadProgress(Math.round((step / totalSteps) * 100));
        };

        const currentUserId = await ensureUserId();
        if (!currentUserId) throw new Error("No user");

        const uploads: Array<{
          imagePath: string;
          thumbPath: string | null;
          lat: number | null;
          lng: number | null;
        }> = [];

        for (const file of selectedFiles) {
          const coords = await extractPhotoGps(file);
          const compressed = await compressImage(file);
          bump();
          const thumbnail = await createThumbnail(file);
          bump();

          const { imagePath, thumbPath } = await uploadActivityImage(
            currentUserId,
            activity.id,
            compressed,
            thumbnail
          );
          bump();
          uploads.push({
            imagePath,
            thumbPath: thumbPath ?? null,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
          });
        }

        const insertRows = uploads.map((upload, index) => ({
          imagePath: upload.imagePath,
          thumbPath: upload.thumbPath ?? null,
          sortOrder: existingPhotoCount + index,
          lat: upload.lat,
          lng: upload.lng,
        }));
        const { error: insertError } = await insertActivityPhotos(
          currentUserId,
          activity.id,
          insertRows
        );
        if (insertError) throw insertError;

        const coverFromExisting = !removeExistingPhotos && existingPhotos.length > 0;
        if (!coverFromExisting) {
          imageUrl = uploads[0]?.imagePath ?? null;
          thumbUrl = uploads[0]?.thumbPath ?? null;
        }
      }

      if (removeExistingPhotos && selectedFiles.length === 0) {
        imageUrl = null;
        thumbUrl = null;
      }

      const { error } = await updateActivity({
        id: activity.id,
        title,
        distance_km: distanceValue,
        duration_min: durationValue,
        date,
        feeling: feelingValue,
        effort: effortValue,
        notes: note,
        note_image_url: imageUrl,
        note_thumb_image_url: thumbUrl,
      });

      if (error) throw error;

      setUploadProgress(100);

      if (deletePaths.length > 0) {
        try {
          await deleteActivityImages(deletePaths);
        } catch (removeErr: any) {
          console.warn("[EditActivity] Failed to delete old images", removeErr?.message || removeErr);
        }
      }

      const { error: equipmentError } = await replaceActivityEquipment(
        activity.id,
        selectedEquipmentIds
      );

      if (equipmentError) {
        throw equipmentError;
      }

      if (removeExistingPhotos || selectedFiles.length > 0) {
        void resolveActivityLocationTag(activity.id);
      }
    } catch (err: any) {
      console.error("[EditActivity] Save error:", err);
      setUploadError(err?.message || "Could not save changes");
      setSaving(false);
      setUploading(false);
      return;
    }

    setSaving(false);
    setUploading(false);

    onUpdated();
    setAnimateIn(false);
    setTimeout(onClose, 300);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this activity?")) return;

    const pathsToDelete = new Set<string>();
    if (activity.note_image_url) pathsToDelete.add(activity.note_image_url);
    if (activity.note_thumb_image_url) pathsToDelete.add(activity.note_thumb_image_url);

    try {
      const { data, error } = await deleteActivityPhotosByActivity(activity.id);
      if (error) throw error;
      data.forEach((row) => {
        if (row.image_path) pathsToDelete.add(row.image_path);
        if (row.thumb_path) pathsToDelete.add(row.thumb_path);
      });
    } catch (removeErr: any) {
      console.warn("[EditActivity] Could not delete activity photos", removeErr?.message || removeErr);
    }

    if (pathsToDelete.size > 0) {
      try {
        await deleteActivityImages(Array.from(pathsToDelete));
      } catch (removeErr: any) {
        console.warn("[EditActivity] Could not delete image from storage", removeErr?.message || removeErr);
      }
    }

    const { error } = await deleteActivity(activity.id);

    if (error) {
      console.error("[EditActivity] Delete error:", error.message);
      alert("Could not delete activity");
      return;
    }

    onDeleted();
    setAnimateIn(false);
    setTimeout(onClose, 300);
  };

  const handleOverlayClick = () => {
    const elapsed = Date.now() - openedAtRef.current;
    if (elapsed < 200) {
      return;
    }
    onClose();
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (startY.current == null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      e.preventDefault();
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    const threshold = 80;
    if (dragY > threshold) {
      setAnimateIn(false);
      setTimeout(() => {
        onClose();
      }, 200);
    }
    setDragY(0);
    startY.current = null;
  };

  const addEquipment = async (name: string, notes: string) => {
    const currentUserId = await ensureUserId();
    if (!currentUserId) return null;

    const { equipment: created } = await createEquipment({
      userId: currentUserId,
      name,
      notes: notes || undefined,
    });

    if (!created) {
      return null;
    }

    setEquipment((prev) => [created, ...prev]);
    setSelectedEquipmentIds((prev) =>
      prev.includes(created.id) ? prev : [...prev, created.id]
    );

    return created;
  };

  return {
    title,
    setTitle,
    distanceKm,
    setDistanceKm,
    activityType,
    preference,
    defaultFields,
    optionalFields,
    showOptionalDistance,
    setShowOptionalDistance,
    duration,
    setDuration,
    showOptionalDuration,
    setShowOptionalDuration,
    date,
    setDate,
    rating,
    setRating,
    effort,
    setEffort,
    equipment,
    selectedEquipmentIds,
    setSelectedEquipmentIds,
    note,
    setNote,
    noteImageUrl,
    setNoteImageUrl,
    noteThumbImageUrl,
    setNoteThumbImageUrl,
    selectedFiles,
    setSelectedFiles,
    removeExistingPhotos,
    setRemoveExistingPhotos,
    existingPhotoCount,
    existingPhotoTotal,
    appendFiles,
    uploading,
    uploadError,
    uploadProgress,
    setUploadError,
    setUploadProgress,
    saving,
    animateIn,
    dragY,
    fileInputRef,
    cameraInputRef,
    handleDistanceChange,
    distanceDisplay,
    handleSave,
    handleDelete,
    handleOverlayClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    addEquipment,
  };
}
