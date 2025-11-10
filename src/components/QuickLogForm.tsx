import { useEffect, useState, useRef } from "react";
import type { Preset } from "../types";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Zap, Frown, Meh, Smile, Laugh } from "lucide-react";
import ModalSheet from "../components/ModalSheet";

type QuickLogFormProps = {
  type: "run" | "ride";
  onClose: () => void;
  onLogged: (activityId: string) => void; // ✅ returns activity id
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

    const { data, error } = await supabase
  .from("activities")
  .insert([
    {
      user_id: user.id,
      type,
      date,
      distance_km: Number(distance),
      feeling: rating,
      title,
      effort,
    },
  ])
  .select("id")
  .single();

if (error) {
  console.error("[QuickLogForm] Error saving activity:", error.message);
  return;
}

const newActivityId = data?.id;
if (!newActivityId) {
  console.warn("[QuickLogForm] No activity ID returned after insert");
  return;
}

if (activePreset) {
  await supabase
    .from("presets")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", activePreset.id);
}

ding.play();
onLogged(newActivityId); // ✅ pass id to Home


setAnimateIn(false);
setTimeout(() => {
  onClose();
  navigate("/");
}, 400);


    setAnimateIn(false);
    setTimeout(() => {
      onClose();
      navigate("/");
    }, 400);
  };

return (
  <ModalSheet onClose={onClose} enableDragToClose>
    {/* Last 3 Presets */}
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => usePreset(p)}
          className={`px-3 py-1 rounded-full text-sm border transition whitespace-nowrap ${
            activePreset?.id === p.id
              ? "bg-amber-300 border-amber-400 text-primary-text"
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
            ? "bg-amber-300 border-amber-400 text-primary-text"
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

    {/* Feeling & Effort (unchanged) */}
    {/* ... your existing feeling/effort block ... */}

    {/* Save */}
    <button
      onClick={save}
      className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
    >
      Save
    </button>
  </ModalSheet>
);

}
