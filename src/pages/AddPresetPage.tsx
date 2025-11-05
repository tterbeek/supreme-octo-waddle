import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AddPresetPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<"run" | "ride">("run");
  const [name, setName] = useState("");
  const [distance, setDistance] = useState("");

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("presets").insert({
      user_id: user.id,
      type,
      name,
      distance_km: Number(distance)
    });

    navigate("/presets");
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <label className="block text-sm text-gray-600 mb-1">Type</label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as any)}
        className="border w-full rounded-md p-2 mb-4"
      >
        <option value="run">Run</option>
        <option value="ride">Ride</option>
      </select>

      <label className="block text-sm text-gray-600 mb-1">Name</label>
      <input
        className="border w-full rounded-md p-2 mb-4"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="block text-sm text-gray-600 mb-1">Distance (km)</label>
      <input
        className="border w-full rounded-md p-2 mb-6"
        value={distance}
        type="number"
        onChange={(e) => setDistance(e.target.value)}
      />

      <button
        onClick={save}
        className="bg-amber-300 border border-amber-400 text-black w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
      >
        Save
      </button>
    </div>
  );
}
