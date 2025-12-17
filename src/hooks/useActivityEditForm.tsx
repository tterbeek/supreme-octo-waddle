import { useEffect, useRef, useState, type TouchEvent } from "react";
import {
  resolveActivityFields,
  type ActivityPreference,
} from "../lib/resolveActivityFields";
import { resolveEditFields } from "../lib/resolveEditActivityFields";
import { kmToMiles, milesToKm } from "../lib/units";
import { getCurrentUser } from "../services/auth.service";
import { fetchActivityPreference } from "../services/quickLog.service";
import {
  compressImage,
  uploadActivityImage,
  deleteActivityImages,
} from "../services/activityMedia.service";
import { updateActivity, deleteActivity } from "../services/activity.service";

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
  const [showOptionalDistance, setShowOptionalDistance] = useState(false);
  const [duration, setDuration] = useState(activity.duration_min || "");
  const [showOptionalDuration, setShowOptionalDuration] = useState(false);
  const [date, setDate] = useState(activity.date || "");
  const [rating, setRating] = useState(activity.feeling || 3);
  const [effort, setEffort] = useState(activity.effort || 3);
  const [note, setNote] = useState(activity.notes || "");
  const [noteImageUrl, setNoteImageUrl] = useState(activity.note_image_url || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const originalImagePath = useRef<string | null>(activity.note_image_url || null);
  const openedAtRef = useRef<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const distanceDisplay =
    distanceKm == null
      ? ""
      : unitSystem === "imperial"
      ? String(Math.round(kmToMiles(distanceKm) * 100) / 100)
      : String(distanceKm);

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
    setShowOptionalDistance(false);
    setShowOptionalDuration(false);

    const loadPreference = async () => {
      setPreference(undefined);

      if (activityType === "restore") return;

      const user = await getCurrentUser();

      if (!user || cancelled) return;

      const pref = await fetchActivityPreference(user.id, activityType);
      if (!cancelled) {
        setPreference(pref);
      }
    };

    loadPreference();

    return () => {
      cancelled = true;
    };
  }, [activityType]);

  const handleSave = async () => {
    setSaving(true);
    setUploadError(null);
    let imageUrl = noteImageUrl;
    const deletePaths: string[] = [];

    const distanceValue =
      (defaultFields.includes("distance_km") || showOptionalDistance) && distanceKm != null
        ? distanceKm
        : null;

    const durationValue =
      (defaultFields.includes("duration_min") || showOptionalDuration) && duration
        ? Number(duration)
        : null;

    const effortValue =
      ["run", "ride", "swim", "hike"].includes(activityType)
        ? Number(effort) || null
        : null;

    const feelingValue = Number(rating) || null;

    try {
      if (selectedFile) {
        setUploading(true);
        setUploadProgress(10);

        const compressed = await compressImage(selectedFile);

        setUploadProgress(40);

        const user = await getCurrentUser();
        if (!user) throw new Error("No user");

        const path = await uploadActivityImage(user.id, activity.id, compressed);

        setUploadProgress(80);
        imageUrl = path;

        if (originalImagePath.current && originalImagePath.current !== imageUrl) {
          deletePaths.push(originalImagePath.current);
        }
      }

      if (noteImageUrl === null && selectedFile === null && activity.note_image_url) {
        imageUrl = null;
        if (originalImagePath.current) {
          deletePaths.push(originalImagePath.current);
        }
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
      });

      if (error) throw error;

      setUploadProgress(100);

      if (deletePaths.length > 0) {
        try {
          await deleteActivityImages(deletePaths);
        } catch (removeErr: any) {
          console.warn("[EditActivity] Failed to delete old images", removeErr?.message || removeErr);
        } finally {
          originalImagePath.current = imageUrl;
        }
      } else {
        originalImagePath.current = imageUrl;
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

    if (activity.note_image_url) {
      try {
        await deleteActivityImages([activity.note_image_url]);
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
    if (elapsed < 400) {
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
    note,
    setNote,
    noteImageUrl,
    setNoteImageUrl,
    selectedFile,
    setSelectedFile,
    uploading,
    uploadError,
    uploadProgress,
    setUploadError,
    setUploadProgress,
    saving,
    animateIn,
    dragY,
    fileInputRef,
    handleDistanceChange,
    distanceDisplay,
    handleSave,
    handleDelete,
    handleOverlayClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
