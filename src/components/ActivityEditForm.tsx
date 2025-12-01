import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { Zap, Frown, Meh, Smile, Laugh, Trash2, Camera } from "lucide-react";

const NOTE_BUCKET = "actvity-notes"; // adjust if bucket name changes

type ActivityEditFormProps = {
  activity: any; // existing activity record
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
};

export default function ActivityEditForm({
  activity,
  onClose,
  onUpdated,
  onDeleted,
}: ActivityEditFormProps) {
  const [title, setTitle] = useState(activity.title || "");
  const [distance, setDistance] = useState(activity.distance_km || "");
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    openedAtRef.current = Date.now();
    setAnimateIn(true);
    return () => {};
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setUploadError(null);
    let imageUrl = noteImageUrl;
    const deletePaths: string[] = [];

    try {
      if (selectedFile) {
        setUploading(true);
        setUploadProgress(10);

        // Compress on edit as well to keep consistency
        const compressed = await (async () => {
          const maxDim = 1600;
          const quality = 0.75;
          return new Promise<Blob>((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(selectedFile);
            img.onload = () => {
              const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
              const canvas = document.createElement("canvas");
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Cannot get canvas context"));
                return;
              }
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              canvas.toBlob(
                (blob) => {
                  URL.revokeObjectURL(objectUrl);
                  if (!blob) {
                    reject(new Error("Unable to compress image"));
                  } else {
                    resolve(blob);
                  }
                },
                "image/jpeg",
                quality
              );
            };
            img.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error("Could not load image"));
            };
            img.src = objectUrl;
          });
        })();

        setUploadProgress(40);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) throw userErr || new Error("No user");

        const path = `${user.id}/${activity.id}-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from(NOTE_BUCKET)
          .upload(path, compressed, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        setUploadProgress(80);
        imageUrl = path;

        if (originalImagePath.current && originalImagePath.current !== imageUrl) {
          deletePaths.push(originalImagePath.current);
        }
      }

      if (noteImageUrl === null && selectedFile === null && activity.note_image_url) {
        // cleared existing image
        imageUrl = null;
        if (originalImagePath.current) {
          deletePaths.push(originalImagePath.current);
        }
      }

      await supabase
        .from("activities")
        .update({
          title,
          distance_km: Number(distance),
          date,
          feeling: rating,
          effort,
          notes: note,
          note_updated_at: new Date().toISOString(),
          note_image_url: imageUrl,
        })
        .eq("id", activity.id);

      setUploadProgress(100);

      // best-effort cleanup of old images
      if (deletePaths.length > 0) {
        const { error: removeErr } = await supabase.storage
          .from(NOTE_BUCKET)
          .remove(deletePaths);
        if (removeErr) {
          console.warn("[EditActivity] Failed to delete old images", removeErr.message);
        } else {
          // avoid re-deleting on subsequent edits
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

    // Best effort: remove associated image from storage
    if (activity.note_image_url) {
      const { error: removeErr } = await supabase.storage
        .from(NOTE_BUCKET)
        .remove([activity.note_image_url]);
      if (removeErr) {
        console.warn("[EditActivity] Could not delete image from storage", removeErr.message);
      }
    }

    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", activity.id);

    if (error) {
      console.error("[EditActivity] Delete error:", error.message);
      alert("Could not delete activity");
      return;
    }

    onDeleted();
    setAnimateIn(false);
    setTimeout(onClose, 300);
  };

  return (
<div
  ref={overlayRef}
  className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 overscroll-none"
  onClick={() => {
    const elapsed = Date.now() - openedAtRef.current;
    if (elapsed < 400) {
      return;
    }
    onClose();
  }}
>
  <div
    ref={panelRef}
    onClick={(e) => e.stopPropagation()}
    onTouchStart={(e) => {
      startY.current = e.touches[0].clientY;
    }}
    onTouchMove={(e) => {
      if (startY.current == null) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      if (diff > 0) {
        e.preventDefault();
        setDragY(diff);
      }
    }}
    onTouchEnd={() => {
      const threshold = 80;
      if (dragY > threshold) {
        setAnimateIn(false);
        setTimeout(() => {
          console.log("[ActivityEditForm] drag close -> onClose");
          onClose();
        }, 200);
      }
      setDragY(0);
      startY.current = null;
    }}
    style={{
      transform: `translateY(${dragY}px)`,
      touchAction: "none",
    }}
    className={`w-full max-w-md bg-warm-100 rounded-t-2xl p-6 transition-transform duration-300 
      ${animateIn ? "translate-y-0" : "translate-y-full"} animate-fadeIn 
      shadow-lg will-change-transform sm:rounded-2xl sm:mt-20`}
  >
    <div className="w-10 h-1.5 bg-warm-200 rounded-full mx-auto mb-4" />
    
        <h2 className="text-lg font-semibold text-center mb-4">
          Edit Activity
        </h2>

        {/* Title */}
        <label className="text-sm text-gray-600">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-warm-200 rounded-md p-2 mb-4"
        />

        {/* Date */}
        <label className="text-sm text-gray-600">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-warm-200 rounded-md p-2 mb-4"
        />

        {/* Distance */}
        <label className="text-sm text-gray-600">Distance (km)</label>
        <input
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="w-full border border-warm-200 rounded-md p-2 mb-4"
        />

        {/* Feeling & Effort */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">
            Feeling & Effort
          </label>

          <div className="flex flex-col items-center gap-4">
            {/* Feeling Row */}
            <div className="flex justify-between w-full max-w-sm">
              {[Frown, Meh, Smile, Laugh].map((Icon, i) => {
                const value = i + 1;
                const active = rating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`transition transform active:scale-95 ${
                      active ? "scale-110" : "opacity-70"
                    }`}
                  >
                    <Icon
                      className={`w-7 h-7 ${
                        active ? "text-movenotes-accent" : "text-gray-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Effort Row */}
            <div className="flex justify-between w-full max-w-sm">
              {[1, 2, 3, 4, 5].map((val) => {
                const active = val <= effort;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEffort(val)}
                    className={`transition transform active:scale-95 ${
                      effort === val ? "scale-110" : ""
                    }`}
                  >
                    <Zap
                      className={`w-5 h-5 ${
                        active ? "text-movenotes-accent" : "text-gray-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notes */}
        <label className="text-sm text-gray-600">Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add a short note about your activity..."
          className="w-full border border-warm-200 rounded-md p-2 mb-4 resize-none focus:ring-1 focus:ring-movenotes-primary"
        />

        {/* Photo attach / clear */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
          >
            <Camera className="w-4 h-4 text-amber-700" />
            <span>Snap or attach</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setSelectedFile(file);
              setUploadError(null);
              setUploadProgress(0);
            }}
            className="hidden"
          />
          {noteImageUrl && (
            <button
              type="button"
              className="text-xs text-red-600 underline"
              onClick={() => {
                setNoteImageUrl(null);
                setSelectedFile(null);
              }}
            >
              Remove current image
            </button>
          )}
          {selectedFile && (
            <span className="text-xs text-gray-600">
              Selected: {selectedFile.name}
            </span>
          )}
        </div>

        {uploadError && (
          <p className="text-sm text-red-600 mb-2">{uploadError}</p>
        )}
        {(uploading || saving) && (
          <div className="mb-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-movenotes-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {uploading ? "Uploading image..." : "Saving..."}
            </p>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-movenotes-primary text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full mt-3 py-3 border border-movenotes-accent text-movenotes-accent rounded-full text-sm font-medium hover:bg-movenotes-accent/10 transition"
        >
          <Trash2 className="inline w-4 h-4 mr-1 -mt-0.5" />
          Delete Activity
        </button>
      </div>
    </div>
  );
}
