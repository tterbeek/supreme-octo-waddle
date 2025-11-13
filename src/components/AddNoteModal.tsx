// src/components/AddNoteModal.tsx
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabaseClient";

interface AddNoteModalProps {
  activityId: string;
  onSave: () => void;
  onSkip: () => void;
}

export default function AddNoteModal({
  activityId,
  onSave,
  onSkip
}: AddNoteModalProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const userInteracted = useRef(false);

  // ⏳ Auto-close only if NO interaction
  useEffect(() => {
    if (userInteracted.current) return; // 🚫 User interacted → disable autoclose

    const t = setTimeout(() => {
      console.log("[AddNoteModal] Auto-closing (no interaction)");
      setVisible(false);
      setTimeout(onSkip, 400);
    }, 4500);

    return () => clearTimeout(t);
  }, [onSkip]);

  const markInteraction = () => {
    userInteracted.current = true; // 👈 permanently disable auto-close
  };

  const handleSave = async () => {
    if (!note.trim()) {
      onSkip();
      return;
    }

    setSaving(true);

    await supabase
      .from("activities")
      .update({
        notes: note,
        note_updated_at: new Date().toISOString(),
      })
      .eq("id", activityId);

    setSaving(false);

    setVisible(false);
    setTimeout(onSave, 400);
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
            onClick={(e) => {
              e.stopPropagation();
              markInteraction();        // 👈 tapping inside prevents auto-close
            }}
            className="w-full max-w-md bg-movenotes-surface rounded-t-2xl p-6 text-movenotes-text shadow-lg"
          >
            <div className="w-10 h-1.5 bg-movenotes-border rounded-full mx-auto mb-4"></div>

            <h2 className="text-lg font-semibold text-center mb-3 text-movenotes-primary">
              Add a note about this activity
            </h2>

            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                markInteraction();        // 👈 typing disables auto-close
              }}
              onFocus={markInteraction}    // 👈 focusing disables auto-close
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
