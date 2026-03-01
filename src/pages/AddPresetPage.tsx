import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles, milesToKm } from "../lib/units";

type AddPresetPageProps = {
  embedded?: boolean;
  onSaved?: () => void;
};

export default function AddPresetPage({
  embedded = false,
  onSaved,
}: AddPresetPageProps) {
  const navigate = useNavigate();
  const [type, setType] = useState<"run" | "ride">("run");
  const [name, setName] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const { unitSystem } = useUnitSystem();

  const distanceDisplay =
    distanceKm == null
      ? ""
      : unitSystem === "imperial"
      ? String(Math.round(kmToMiles(distanceKm) * 100) / 100)
      : String(distanceKm);

  const handleDistanceChange = (value: string) => {
    if (value === "") {
      setDistanceKm(null);
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    const kmValue = unitSystem === "imperial" ? milesToKm(numeric) : numeric;
    setDistanceKm(kmValue);
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("presets").insert({
      user_id: user.id,
      type,
      name,
      distance_km: distanceKm ?? null
    });

    if (embedded) {
      onSaved?.();
      return;
    }

    navigate("/presets");
  };

  return (
    <div className={`p-4 ${embedded ? "max-w-2xl" : "max-w-md"} mx-auto`}>
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

      <label className="block text-sm text-gray-600 mb-1">
        Distance ({unitSystem === "imperial" ? "mi" : "km"})
      </label>
      <input
        className="border w-full rounded-md p-2 mb-6"
        value={distanceDisplay}
        type="number"
        onChange={(e) => handleDistanceChange(e.target.value)}
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
