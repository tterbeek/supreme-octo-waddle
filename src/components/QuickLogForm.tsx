import { useEffect, useState } from "react";
import type { Preset } from "../types";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import Toast from "./Toast";
import { Star } from "lucide-react";


type QuickLogFormProps = {
  type: "run" | "ride";
  onClose: () => void;
};

export default function QuickLogForm({ type, onClose }: QuickLogFormProps) {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const [distance, setDistance] = useState<number | string>("");
  const [rating, setRating] = useState(3);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [animateIn, setAnimateIn] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const ding = new Audio("/sounds/ding.mp3");

  useEffect(() => {
    setAnimateIn(true);

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("presets")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", type)
        .order("last_used_at", { ascending: false })
        .limit(3);

      setPresets(data || []);

      if (data && data.length > 0) {
        setActivePreset(data[0]);
        setDistance(data[0].distance_km ?? "");
      }
    };

    load();
  }, [type]);

  const usePreset = (preset: Preset) => {
    setActivePreset(preset);
    setDistance(preset.distance_km ?? "");
  };

  const useCustom = () => {
    setActivePreset(null);
    setDistance("");
  };

  const save = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("activities").insert({
      user_id: user.id,
      type,
      date,
      distance_km: Number(distance),
      feeling: rating
    });

    if (activePreset) {
      await supabase
        .from("presets")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", activePreset.id);
    }

    ding.play();
    setShowToast(true);

    setAnimateIn(false);
    setTimeout(() => {
      onClose();
      navigate("/");
    }, 400);
  };

  return (
    <div
  className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
  onClick={onClose}
>
<div
  onClick={(e) => e.stopPropagation()}
  className={`w-full max-w-md bg-white rounded-t-2xl p-6 transition-all ${
    animateIn ? "translate-y-0" : "translate-y-full"
  } animate-fadeIn`}
>
<div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>

        {/* Last 3 Presets */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => usePreset(p)}
              className={`px-3 py-1 rounded-full text-sm border transition whitespace-nowrap ${
                activePreset?.id === p.id
                  ? "bg-amber-300 border-amber-400 text-black"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              {p.name}
            </button>
          ))}

          {/* Custom */}
          <button
            onClick={useCustom}
            className={`px-3 py-1 rounded-full text-sm border transition whitespace-nowrap ${
              activePreset === null
                ? "bg-amber-300 border-amber-400 text-black"
                : "border-gray-300 text-gray-600"
            }`}
          >
            Custom
          </button>
        </div>

        {/* Date */}
        <label className="text-sm text-gray-600">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
        />

        {/* Distance */}
        <label className="text-sm text-gray-600">Distance (km)</label>
        <input
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
        />

        {/* Feeling */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">Feeling</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="transition active:scale-95"
              >
              <Star
                className={`w-7 h-7 ${
                  value <= rating
                    ? "fill-amber-400 text-amber-400 animate-pulseTap"
                    : "text-gray-300"
                }`}
              />

              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          className="bg-amber-300 border border-amber-400 text-black w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
        >
          Save
        </button>
      </div>

      {showToast && (
        <Toast message="Activity logged ✅" onClose={() => setShowToast(false)} />
      )}
    </div>
  );
}
