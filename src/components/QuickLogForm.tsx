import { useEffect, useState } from "react";
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
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState<number>(3);

  const ding = new Audio("/sounds/ding.mp3");

  const [showMorePresets, setShowMorePresets] = useState(false);


  useEffect(() => {


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
        .order("last_used_at", { ascending: false });

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


setTimeout(() => {
  onClose();
  navigate("/");
}, 400);


    setTimeout(() => {
      onClose();
      navigate("/");
    }, 400);
  };

  console.log("QuickLogForm build timestamp: 2025-01-13 22:15");

return (
  <>
    {/* MAIN QUICKLOG SHEET */}
    <ModalSheet onClose={onClose} enableDragToClose>
      {/* Presets */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {presets.slice(0, 3).map((p) => (
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

        {/* More… */}
        {presets.length > 3 && (
          <button
            onClick={() => setShowMorePresets(true)}
            className="px-3 py-1 rounded-full text-sm border border-gray-300 text-gray-600 whitespace-nowrap"
          >
            More…
          </button>
        )}


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
        <label className="block text-sm text-gray-600 mb-1">
          Feeling & Effort
        </label>

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

      {/* Save */}
      <button
        onClick={save}
        className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
      >
        Save
      </button>
    </ModalSheet>

    {/* SECOND SHEET: ALL PRESETS */}
    {showMorePresets && (
<ModalSheet onClose={() => setShowMorePresets(false)}>
  <h2 className="text-lg font-semibold mb-4 text-center">All Presets</h2>
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pb-4">
                {/* Custom goes FIRST */}
                <button
                  onClick={() => {
                    useCustom();
                    setShowMorePresets(false);
                  }}
                  className="p-3 border rounded-md text-left bg-amber-50"
                >
                  <div className="font-medium text-gray-800">Custom</div>
                  <div className="text-sm text-gray-500">
                    Create your own manual entry
                  </div>
                </button>


          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                usePreset(p);
                setShowMorePresets(false);
              }}
              className="p-3 border rounded-md text-left"
            >
              <div className="font-medium text-gray-800">{p.name}</div>
              {p.distance_km && (
                <div className="text-sm text-gray-500">
                  {p.distance_km} km · Effort {p.effort ?? 3}
                </div>
              )}
            </button>
          ))}
        </div>
      </ModalSheet>
    )}
  </>
);
}