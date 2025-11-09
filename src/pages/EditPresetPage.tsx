import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, useParams } from "react-router-dom";

export default function EditPresetPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [distance, setDistance] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("presets").select("*").eq("id", id).single();
      if (data) {
        setName(data.name);
        setDistance(data.distance_km);
      }
    };
    load();
  }, [id]);

  const save = async () => {
    await supabase.from("presets").update({
      name,
      distance_km: Number(distance)
    }).eq("id", id);
    navigate("/presets");
  };

  const remove = async () => {
    await supabase.from("presets").delete().eq("id", id);
    navigate("/presets");
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <label className="block text-sm text-gray-600 mb-1">Name</label>
      <input className="border w-full rounded-md p-2 mb-4" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="block text-sm text-gray-600 mb-1">Distance (km)</label>
      <input className="border w-full rounded-md p-2 mb-6" value={distance} type="number" onChange={(e) => setDistance(e.target.value)} />

      <button onClick={save} className="bg-amber-300 border border-amber-400 text-movenotes-accent w-full py-3 rounded-full text-lg font-medium transition hover:-translate-y-0.5 mb-4">
        Save
      </button>

      <button onClick={remove} className="text-red-600 underline w-full text-center">
        Delete
      </button>
    </div>
  );
}
