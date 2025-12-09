// src/components/AddNoteModal.tsx
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import { supabase } from "../supabaseClient";

interface AddNoteModalProps {
  activityId: string;
  onSave: () => void;
  onSkip: () => void;
}

const NOTE_BUCKET = "actvity-notes"; // adjust if your bucket name differs

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [visible, setVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const writingSoundRef = useRef<HTMLAudioElement | null>(null);

  // 🛑 Tracks whether the user has interacted with the modal
  const userInteracted = useRef(false);

  // 🔐 Mark ANY interaction
  const markInteraction = () => {
    userInteracted.current = true;
  };

  // ⏳ Auto-close only if NO interaction
  useEffect(() => {
    writingSoundRef.current = new Audio("/sounds/writing.mp3");

    const t = setTimeout(() => {
      if (!userInteracted.current) {
        console.log("[AddNoteModal] Auto-closing (no interaction)");
        setVisible(false);
        setTimeout(onSkip, 400);
      }
    }, 4500);

    return () => clearTimeout(t);
  }, [onSkip]);

  const compressImage = async (file: File) => {
    const maxDim = 1600;
    const quality = 0.75;

    return new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
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
  };

  const handleSave = async () => {
    markInteraction(); // user clearly acted

    if (!note.trim() && !selectedFile) {
      onSkip();
      return;
    }

    setSaving(true);
    setUploadError(null);
    let imageUrl: string | null = null;

    try {
      if (selectedFile) {
        setUploading(true);
        setUploadProgress(10);

        const compressed = await compressImage(selectedFile);
        setUploadProgress(40);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) throw userErr || new Error("No user");

        const path = `${user.id}/${activityId}-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from(NOTE_BUCKET)
          .upload(path, compressed, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        setUploadProgress(80);
        // Store the storage path; frontend will request signed URLs
        imageUrl = path;
      }

      await supabase
        .from("activities")
        .update({
          notes: note || null,
          note_updated_at: new Date().toISOString(),
          note_image_url: imageUrl,
        })
        .eq("id", activityId);

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
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
          // ⛔ Close ONLY if user has NOT interacted
          onClick={() => {
            if (!userInteracted.current) {
              setVisible(false);
              setTimeout(onSkip, 400);
            }
          }}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 25 }}
            // 🛑 Prevent interaction from bubbling to the backdrop
            onClick={(e) => {
              e.stopPropagation();
              markInteraction();
            }}
            className="w-full max-w-md bg-movenotes-surface rounded-t-2xl p-6 text-movenotes-text shadow-lg"
          >
            <div className="w-10 h-1.5 bg-movenotes-border rounded-full mx-auto mb-4" />

            <h2 className="text-lg font-semibold text-center mb-3 text-movenotes-primary">
              Add a note about this activity
            </h2>

            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                markInteraction(); // typing disables auto-close
              }}
              onFocus={markInteraction} // tapping input disables auto-close
              placeholder="How did it feel today?"
              className="w-full h-28 border border-movenotes-border rounded-lg p-2 bg-movenotes-bg text-movenotes-text resize-none focus:ring-2 focus:ring-movenotes-primary outline-none mb-4"
            />

            <div className="mb-3">
        
              <div className="flex items-center gap-3">
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
                    markInteraction();
                    setSelectedFile(file);
                    setUploadProgress(0);
                    setUploadError(null);
                  }}
                  className="hidden"
                />
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                    }}
                    className="text-xs text-red-600 underline"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            {(uploading || saving) && (
              <div className="mb-3">
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
              <p className="text-sm text-red-600 mb-2">{uploadError}</p>
            )}

            <div className="flex justify-between gap-3">
              <button
                onClick={() => {
                  setVisible(false);
                  setTimeout(onSkip, 400);
                }}
                disabled={saving}
                className="flex-1 border border-movenotes-border rounded-lg py-2 text-sm text-gray-600 hover:bg-movenotes-bg transition"
              >
                Skip
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
