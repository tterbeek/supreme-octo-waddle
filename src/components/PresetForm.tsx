import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { Zap } from "lucide-react";

type PresetFormProps = {
  type: "run" | "ride";
  onClose: () => void;
  onAdded: () => void;
};

export default function PresetForm({ type, onClose, onAdded }: PresetFormProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [name, setName] = useState("");
  const [distance, setDistance] = useState("");
  const [effort, setEffort] = useState(3);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("presets").insert({
      user_id: user.id,
      type,
      name,
      distance_km: Number(distance),
      effort,
    });

    onAdded();
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
          const diff = e.touches[0].clientY - startY.current;
          if (diff > 0) setDragY(diff);
        }}
        onTouchEnd={() => {
          if (dragY > 80) {
            setAnimateIn(false);
            setTimeout(onClose, 200);
          }
          setDragY(0);
          startY.current = null;
        }}
        style={{ transform: `translateY(${dragY}px)` }}
        className={`w-full max-w-md bg-white rounded-t-2xl p-6 transition-transform ${
          animateIn ? "translate-y-0" : "translate-y-full"
        } animate-fadeIn`}
      >
        <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>

        <h2 className="text-lg font-semibold text-gray-800 mb-4 capitalize">
          Add {type} Preset
        </h2>

        {/* Name */}
        <label className="text-sm text-gray-600">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
          placeholder="Morning Tempo"
        />

        {/* Distance */}
        <label className="text-sm text-gray-600">Distance (km)</label>
        <input
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
        />

        {/* Effort */}
        <label className="text-sm text-gray-600">Effort</label>
        <div className="flex justify-between max-w-xs mx-auto mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setEffort(n)}
              className={`transition transform active:scale-95 ${
                effort === n ? "scale-110" : ""
              }`}
            >
              <Zap
                className={`w-6 h-6 ${
                  n <= effort ? "text-amber-400" : "text-gray-300"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Save */}
        <button
          onClick={save}
          className="bg-amber-300 border border-amber-400 text-black w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
        >
          Save Preset
        </button>
      </div>
    </div>
  );
}
