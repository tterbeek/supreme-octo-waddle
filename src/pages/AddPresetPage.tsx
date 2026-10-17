import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles, milesToKm } from "../lib/units";
import FormPage from "../components/forms/FormPage";
import { FormActions } from "../components/forms/FormLayout";
import { allowFormNavigation } from "../lib/formLifecycle";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (saving) return;
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError("Please sign in again."); return; }

    const { error: saveError } = await supabase.from("presets").insert({
      user_id: user.id,
      type,
      name,
      distance_km: distanceKm ?? null
    });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }

    if (embedded) {
      onSaved?.();
      return;
    }

    allowFormNavigation(() => navigate("/presets"));
  };

  return (
    <FormPage title="Add preset" backTo="/presets" embedded={embedded} busy={saving} dirty={Boolean(name || distanceKm != null || type !== "run")}>
      <label className="block text-sm text-gray-600 mb-1">Type</label>
      <select
        aria-label="Type"
        value={type}
        onChange={(e) => setType(e.target.value as any)}
        className="border w-full rounded-md p-2 mb-4"
      >
        <option value="run">Run</option>
        <option value="ride">Ride</option>
      </select>

      <label className="block text-sm text-gray-600 mb-1">Name</label>
      <input
        aria-label="Name"
        className="border w-full rounded-md p-2 mb-4"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="block text-sm text-gray-600 mb-1">
        Distance ({unitSystem === "imperial" ? "mi" : "km"})
      </label>
      <input
        aria-label="Distance"
        className="border w-full rounded-md p-2 mb-6"
        value={distanceDisplay}
        type="number"
        onChange={(e) => handleDistanceChange(e.target.value)}
      />

      {error && <p role="alert" className="mn-error">{error}</p>}
      <FormActions><button
        disabled={saving}
        onClick={save}
        className="bg-amber-300 border border-amber-400 text-black w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
      >
        {saving ? "Saving…" : "Save preset"}
      </button></FormActions>
    </FormPage>
  );
}
