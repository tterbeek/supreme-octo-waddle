import FormTextarea from "./forms/FormTextarea";
// src/components/AddNoteModal.tsx
import { useState, useEffect, useRef } from "react";
import ModalSheet from "./ModalSheet";
import { FormActions, FormCancel } from "./forms/FormLayout";
import { Camera } from "lucide-react";
import { supabase } from "../supabaseClient";
import { getCurrentUser } from "../services/auth.service";
import { compressImage, createThumbnail, uploadActivityImage } from "../services/activityMedia.service";
import { extractPhotoGps } from "../lib/exifGps";
import { fetchActivityPhotoCount, insertActivityPhotos } from "../services/activityPhotos.service";
import { resolveActivityLocationTag } from "../services/activityLocation.service";
import { refreshSharedActivity } from "../services/circle.service";
import { MAX_ACTIVITY_PHOTOS } from "../lib/photos";
import {
  createImageFile,
  getImage,
  getImages,
  isImagePickerCancelledError,
  type ImageFile,
  type ImageSource,
} from "../lib/media/getImage";

interface AddNoteModalProps {
  activityId: string;
  onSave: () => void;
  onSkip: () => void;
}

export default function AddNoteModal({
  activityId,
  onSave,
  onSkip,
}: AddNoteModalProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<ImageFile[]>([]);
  const writingSoundRef = useRef<HTMLAudioElement | null>(null);
  const appendFiles = (files: ImageFile[]) => {
    if (files.length === 0) return;

    setSelectedFiles((prev) => {
      const available = MAX_ACTIVITY_PHOTOS - prev.length;
      if (available <= 0) {
        setUploadError(`You can attach up to ${MAX_ACTIVITY_PHOTOS} photos.`);
        return prev;
      }

      const nextFiles = files.slice(0, available);
      if (files.length > available) {
        setUploadError(`You can attach up to ${MAX_ACTIVITY_PHOTOS} photos.`);
      } else {
        setUploadError(null);
      }

      setUploadProgress(0);
      return [...prev, ...nextFiles];
    });
  };

  const handlePickImage = async (source: ImageSource) => {
    setUploadError(null);

    try {
      if (source === "library") {
        const remaining = MAX_ACTIVITY_PHOTOS - selectedFiles.length;
        if (remaining <= 0) {
          setUploadError(`You can attach up to ${MAX_ACTIVITY_PHOTOS} photos.`);
          return;
        }

        const images = await getImages("library", {
          maxCount: remaining,
        });
        appendFiles(
          images.map((image, index) =>
            createImageFile(
              image.blob,
              `activity-photo-${Date.now()}-${index + 1}`,
              image.coords ?? null
            )
          )
        );
        return;
      }

      const image = await getImage(source);
      appendFiles([
        createImageFile(
          image.blob,
          `activity-photo-${Date.now()}`,
          image.coords ?? null
        ),
      ]);
    } catch (err: any) {
      if (isImagePickerCancelledError(err)) return;
      console.error("[AddNoteModal] Image picker error", err);
      setUploadError(err?.message || "Could not select image.");
    }
  };

  // 🎵 Preload sound
  useEffect(() => {
    writingSoundRef.current = new Audio("/sounds/writing.mp3");
  }, []);

  const handleSave = async () => {

    if (!note.trim() && selectedFiles.length === 0) {
      onSkip();
      return;
    }

    setSaving(true);
    setUploadError(null);
    let coverImageUrl: string | null = null;
    let coverThumbUrl: string | null = null;

    try {
      let currentUserId: string | null = null;
      const { count: existingCount, error: countError } =
        await fetchActivityPhotoCount(activityId);
      if (countError) throw countError;

      if (existingCount + selectedFiles.length > MAX_ACTIVITY_PHOTOS) {
        setUploadError(`You can attach up to ${MAX_ACTIVITY_PHOTOS} photos total.`);
        setSaving(false);
        return;
      }

      if (selectedFiles.length > 0) {
        setUploading(true);
        const totalSteps = selectedFiles.length * 3 + 1;
        let step = 0;
        const bump = () => {
          step += 1;
          setUploadProgress(Math.round((step / totalSteps) * 100));
        };

        const user = await getCurrentUser();
        if (!user) throw new Error("No user");
        currentUserId = user.id;

        const uploads: Array<{
          imagePath: string;
          thumbPath: string | null;
          lat: number | null;
          lng: number | null;
        }> = [];

        for (const file of selectedFiles) {
          const coords = file.coords ?? (await extractPhotoGps(file));
          const compressed = await compressImage(file);
          bump();
          const thumbnail = await createThumbnail(file);
          bump();

          const { imagePath, thumbPath } = await uploadActivityImage(
            user.id,
            activityId,
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

        if (uploads.length > 0) {
          const rows = uploads.map((upload, index) => ({
            imagePath: upload.imagePath,
            thumbPath: upload.thumbPath ?? null,
            sortOrder: existingCount + index,
            lat: upload.lat,
            lng: upload.lng,
          }));
          const { error: insertError } = await insertActivityPhotos(
            user.id,
            activityId,
            rows
          );
          if (insertError) throw insertError;
        }

        coverImageUrl = uploads[0]?.imagePath ?? null;
        coverThumbUrl = uploads[0]?.thumbPath ?? null;
      }

      const updatePayload: Record<string, any> = {
        notes: note || null,
        note_updated_at: new Date().toISOString(),
      };
      if (selectedFiles.length > 0 && existingCount === 0) {
        updatePayload.note_image_url = coverImageUrl;
        updatePayload.note_thumb_image_url = coverThumbUrl;
      }

      const { error: noteError } = await supabase.from("activities").update(updatePayload).eq("id", activityId);
      if (noteError) throw noteError;
      if (selectedFiles.length > 0) {
        if (currentUserId) {
          try {
            await refreshSharedActivity(activityId, currentUserId);
          } catch (refreshErr: any) {
            console.warn(
              "[AddNoteModal] Could not refresh shared Circle activity",
              refreshErr?.message || refreshErr
            );
          }
        }
        void resolveActivityLocationTag(activityId);
      }

      setUploadProgress(100);
      setSaving(false);
      setUploading(false);

      if (writingSoundRef.current) {
        writingSoundRef.current.currentTime = 0;
        writingSoundRef.current.play().catch(() => {
          /* ignore autoplay blocks */
        });
      }

      onSave();
    } catch (err: any) {
      console.error("[AddNoteModal] Save error", err);
      setUploadError(err?.message || "Could not save note");
      setSaving(false);
      setUploading(false);
    }
  };

  return <ModalSheet title="Add a reflection" onClose={onSkip} dirty={note.length > 0 || selectedFiles.length > 0} busy={saving || uploading}>
    <p className="mn-help">Your activity is already saved. A note or photo is optional.</p>
    <label htmlFor="post-log-note">Want to remember how it felt?</label>
    <FormTextarea id="post-log-note" value={note} onChange={event => setNote(event.target.value)} placeholder="How did it feel?" rows={6} className="w-full" />
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void handlePickImage("camera")} className="md:hidden mn-form-cancel"><Camera size={16} className="inline mr-1" />Open camera</button>
      <button type="button" onClick={() => void handlePickImage("library")} className="mn-form-cancel"><Camera size={16} className="inline mr-1" />Choose photos</button>
      {selectedFiles.length > 0 && <button type="button" onClick={() => setSelectedFiles([])} className="mn-form-cancel">Remove all images</button>}
    </div>
    {selectedFiles.length > 0 && <div className="flex flex-wrap gap-2 text-sm">
      <span>{selectedFiles.length}/{MAX_ACTIVITY_PHOTOS} selected</span>
      {selectedFiles.map((file, index) => <button type="button" key={index} onClick={() => setSelectedFiles(previous => previous.filter((_, i) => i !== index))} className="mn-form-cancel" aria-label={`Remove photo ${index + 1}: ${file.name}`}>{file.name}</button>)}
    </div>}
    {(uploading || saving) && <p role="status" className="mn-help">{uploading ? "Uploading photos…" : "Saving…"} {uploadProgress}%</p>}
    {uploadError && <p role="alert" className="mn-error">{uploadError}</p>}
    <FormCancel disabled={saving}>Done without a reflection</FormCancel>
    <FormActions><button type="button" onClick={() => void handleSave()} disabled={saving}>{saving ? "Saving…" : "Save reflection"}</button></FormActions>
  </ModalSheet>;
}
