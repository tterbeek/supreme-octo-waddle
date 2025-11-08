import { useEffect, useState, useRef } from "react";
import type { Preset } from "../types";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Zap, Frown, Meh, Smile, Laugh } from "lucide-react";

type QuickLogFormProps = {
  type: "run" | "ride";
  onClose: () => void;
  onLogged: () => void; // ✅ add this line
};


export default function QuickLogForm({ type, onClose, onLogged }: QuickLogFormProps) {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const [distance, setDistance] = useState<number | string>("");
  const [rating, setRating] = useState(3);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [animateIn, setAnimateIn] = useState(false);
  const [title, setTitle] = useState("");

  const ding = new Audio("/sounds/ding.mp3");
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  const [effort, setEffort] = useState<number>(3);


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
        setTitle(data[0].name ?? "");
        setEffort(data[0].effort ?? 3); 
      }
    };

    load();
  }, [type]);

const usePreset = (preset: Preset) => {
  setActivePreset(preset);
  setDistance(preset.distance_km ?? "");
  setTitle(preset.name ?? ""); // ✅ new
  setEffort(preset.effort ?? 3); 
};


const useCustom = () => {
  setActivePreset(null);
  setDistance("");
  setTitle(""); // ✅ clear title
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
      feeling: rating,
      title, // ✅ new
      effort
    });

    if (activePreset) {
      await supabase
        .from("presets")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", activePreset.id);
    }

    ding.play();
    onLogged();


    setAnimateIn(false);
    setTimeout(() => {
      onClose();
      navigate("/");
    }, 400);
  };

  return (
<div
  className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 overscroll-none"
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
      e.preventDefault(); // ← BLOCK BROWSER SWIPE REFRESH
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
    touchAction: "none" // ← SUPER IMPORTANT FOR ANDROID
  }}
  className={`w-full max-w-md bg-white rounded-t-2xl p-6 transition-transform ${
    animateIn ? "translate-y-0" : "translate-y-full"
  } animate-fadeIn will-change-transform`}
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
        {/* Title */}
        <label className="text-sm text-gray-600">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-md p-2 mb-4"
        />

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

{/* Feeling & Effort */}
<div className="mb-4">
  <label className="block text-sm text-gray-600 mb-1">Feeling & Effort</label>

  <div className="flex flex-col items-center gap-4">

    {/* Feeling Row */}
    <div className="flex justify-between w-full max-w-sm">
      {[
        { Icon: Frown, value: 1 },
        { Icon: Meh, value: 2 },
        { Icon: Smile, value: 3 },
        { Icon: Laugh, value: 4 },
      ].map(({ Icon, value }) => {
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
                active ? "text-amber-400" : "text-gray-300"
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
                active ? "text-amber-400" : "text-gray-300"
              }`}
            />
          </button>
        );
      })}
    </div>

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


    </div>
  );
}
