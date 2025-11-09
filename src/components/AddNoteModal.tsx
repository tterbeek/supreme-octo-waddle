// src/components/AddNoteModal.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabaseClient";

interface AddNoteModalProps {
  activityId: string;
  onSave: () => void;
  onSkip: () => void;
}

export default function AddNoteModal({ activityId, onSave, onSkip }: AddNoteModalProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(true);

  // 🌿 Auto-close after 4.5 s if no interaction
  useEffect(() => {
    if (note.trim() !== "") return; // typing cancels timer
    const t = setTimeout(() => {
      console.log("[AddNoteModal] Auto-closing (no interaction)");
      setVisible(false); // trigger exit animation
      setTimeout(onSkip, 400); // wait for fade/slide
    }, 4500);
    return () => clearTimeout(t);
  }, [note, onSkip]);

  const handleSave = async () => {
    if (!note.trim()) {
      onSkip();
      return;
    }
setSaving(true);

const { error } = await supabase
  .from("activities")
  .update({
    notes: note,
    note_updated_at: new Date().toISOString(), // ⏰ track last note edit
  })
  .eq("id", activityId);

setSaving(false);

    if (error) {
      console.error("[AddNoteModal] Error saving note:", error.message);
      alert("Could not save note. Please try again.");
    } else {
      console.log("[AddNoteModal] Note saved for activity:", activityId);
      setVisible(false);
      setTimeout(onSave, 400);
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
          onClick={() => {
            setVisible(false);
            setTimeout(onSkip, 400);
          }}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-movenotes-surface rounded-t-2xl p-6 text-movenotes-text shadow-lg"
          >
            <div className="w-10 h-1.5 bg-movenotes-border rounded-full mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-center mb-3 text-movenotes-primary">
              Add a note about this activity
            </h2>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How did it feel today?"
              className="w-full h-28 border border-movenotes-border rounded-lg p-2 bg-movenotes-bg text-movenotes-text resize-none focus:ring-2 focus:ring-movenotes-primary outline-none mb-4"
            />

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
