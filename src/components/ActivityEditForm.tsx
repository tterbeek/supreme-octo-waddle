import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { Zap, Frown, Meh, Smile, Laugh, Trash2 } from "lucide-react";

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
  const [saving, setSaving] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("activities")
      .update({
        title,
        distance_km: Number(distance),
        date,
        feeling: rating,
        effort,
        notes: note,
        note_updated_at: new Date().toISOString(),
      })
      .eq("id", activity.id);

    setSaving(false);

    if (error) {
      console.error("[EditActivity] Save error:", error.message);
      alert("Could not save changes");
      return;
    }

    onUpdated();
    setAnimateIn(false);
    setTimeout(onClose, 300);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this activity?")) return;

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
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
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
            setTimeout(onClose, 200);
          }
          setDragY(0);
          startY.current = null;
        }}
        style={{
          transform: `translateY(${dragY}px)`,
          touchAction: "none",
        }}
        className={`w-full max-w-md bg-warm-100 rounded-t-2xl p-6 transition-transform duration-300 ${
          animateIn ? "translate-y-0" : "translate-y-full"
        } animate-fadeIn`}
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
