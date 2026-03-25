// src/components/AddNoteModal.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import { supabase } from "../supabaseClient";
import { getCurrentUser } from "../services/auth.service";
import { compressImage, createThumbnail, uploadActivityImage } from "../services/activityMedia.service";
import { extractPhotoGps } from "../lib/exifGps";
import { fetchActivityPhotoCount, insertActivityPhotos } from "../services/activityPhotos.service";
import { resolveActivityLocationTag } from "../services/activityLocation.service";
import { refreshSharedActivity } from "../services/circle.service";
import { MAX_ACTIVITY_PHOTOS } from "../lib/photos";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [visible, setVisible] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const writingSoundRef = useRef<HTMLAudioElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const belowNoteRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<HTMLDivElement | null>(null);

  // 🛑 Tracks whether the user has interacted with the modal
  const userInteracted = useRef(false);

  // 🔐 Mark ANY interaction
  const markInteraction = () => {
    userInteracted.current = true;
  };

  const appendFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const available = MAX_ACTIVITY_PHOTOS - selectedFiles.length;
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

  // 🎵 Preload sound
  useEffect(() => {
    writingSoundRef.current = new Audio("/sounds/writing.mp3");
  }, []);

  // 📏 Auto-grow textarea up to available space (falls back to scrollbar)
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const minHeight = 5 * 22; // ~5 lines
    const afterHeight =
      belowNoteRef.current?.getBoundingClientRect().height ?? 0;
    const buttonsHeight = buttonsRef.current?.getBoundingClientRect().height ?? 0;

    textarea.style.height = "auto";
    const textareaTop = textarea.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    const margin = 32; // breathing room above buttons

    const available = viewportHeight - textareaTop - afterHeight - buttonsHeight - margin;
    const maxHeight = Math.max(minHeight, available);
    const desired = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${Math.max(desired, minHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [note, selectedFiles.length, uploadError, uploading, saving, adjustTextareaHeight]);

  useEffect(() => {
    const handleResize = () => {
      adjustTextareaHeight();
      setIsMobileViewport(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustTextareaHeight]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [keyboardOpen, adjustTextareaHeight]);

  const handleSave = async () => {
    markInteraction(); // user clearly acted

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
          const coords = await extractPhotoGps(file);
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

      await supabase.from("activities").update(updatePayload).eq("id", activityId);
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

      setVisible(false);
      setTimeout(onSave, 400);
    } catch (err: any) {
      console.error("[AddNoteModal] Save error", err);
      setUploadError(err?.message || "Could not save note");
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
          // ⛔ Close ONLY if user has NOT interacted
          onClick={() => {
            const nothingEntered = !note.trim() && selectedFiles.length === 0;
            if (!userInteracted.current || nothingEntered) {
              setVisible(false);
              setTimeout(onSkip, 400);
            }
          }}
        >
          <motion.div
            initial={{ y: "6%", opacity: 0.6, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "6%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 25 }}
            // 🛑 Prevent interaction from bubbling to the backdrop
            onClick={(e) => {
              e.stopPropagation();
              markInteraction();
            }}
            ref={cardRef}
            className="w-full max-w-2xl bg-movenotes-surface rounded-t-2xl p-6 text-movenotes-text shadow-lg max-h-[90vh] flex flex-col transition-[min-height] duration-200"
            style={{ minHeight: keyboardOpen ? "85vh" : "60vh" }}
          >
            <div className="w-10 h-1.5 bg-movenotes-border rounded-full mx-auto mb-4" />

            <h2 className="text-lg font-semibold text-center mb-3 text-movenotes-primary">
              Want to remember how it felt?
            </h2>

            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                markInteraction(); // typing disables auto-close
              }}
              onFocus={() => {
                markInteraction(); // tapping input disables auto-close
                if (isMobileViewport) setKeyboardOpen(true);
              }}
              onBlur={() => {
                if (isMobileViewport) setKeyboardOpen(false);
              }}
              placeholder="How did it feel?"
              rows={5}
              className="w-full border border-movenotes-border rounded-lg p-2 bg-movenotes-bg text-movenotes-text resize-none focus:ring-2 focus:ring-movenotes-primary outline-none mb-4 overflow-hidden"
            />

            <div ref={belowNoteRef} className="mb-3 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
                >
                  <Camera className="w-4 h-4 text-amber-700" />
                  <span>Snap or attach</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex md:hidden items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
                >
                  <Camera className="w-4 h-4 text-amber-700" />
                  <span>Open camera</span>
                </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex md:hidden items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
                  >
                    <Camera className="w-4 h-4 text-amber-700" />
                    <span>Choose photos</span>
                  </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    markInteraction();
                    appendFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    markInteraction();
                    appendFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-xs text-red-600 underline"
                  >
                    Remove all images
                  </button>
                )}
              </div>

              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span>
                    {selectedFiles.length}/{MAX_ACTIVITY_PHOTOS} selected
                  </span>
                  {selectedFiles.map((file, index) => (
                    <button
                      key={`${file.name}-${index}`}
                      type="button"
                      onClick={() =>
                        setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="px-2 py-1 rounded-full border border-movenotes-border bg-white/70 hover:bg-white"
                    >
                      {file.name}
                    </button>
                  ))}
                </div>
              )}

              {(uploading || saving) && (
                <div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-movenotes-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {uploading ? "Compressing & uploading photo..." : "Saving..."}
                  </p>
                </div>
              )}

              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}
            </div>

            <div ref={buttonsRef} className="flex justify-between gap-3">
              <button
                onClick={() => {
                  setVisible(false);
                  setTimeout(onSkip, 400);
                }}
                disabled={saving}
                className="flex-1 border border-movenotes-border rounded-lg py-2 text-sm text-gray-600 hover:bg-movenotes-bg transition"
              >
                Done
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-movenotes-primary text-primary-text rounded-lg py-2 font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Note"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
