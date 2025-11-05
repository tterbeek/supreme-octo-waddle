import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import type { Preset } from "../types";
import { useNavigate } from "react-router-dom";


export default function PresetsPage() {
  const [runPresets, setRunPresets] = useState<Preset[]>([]);
  const [ridePresets, setRidePresets] = useState<Preset[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("presets")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      setRunPresets((data || []).filter(p => p.type === "run"));
      setRidePresets((data || []).filter(p => p.type === "ride"));
    };

    load();
  }, []);

  const renderGroup = (label: string, items: Preset[]) => (
    <div className="mb-6">
      <h2 className="font-semibold text-gray-700 mb-2">{label}</h2>
      <div className="flex flex-col gap-2">
        {items.map((p) => (
          <Link
            key={p.id}
            to={`/presets/${p.id}`}
            className="border border-gray-300 bg-white rounded-xl p-4 transition transform hover:-translate-y-0.5"
          >
            <div className="font-medium text-gray-900">{p.name}</div>
            <div className="text-sm text-gray-600">
              {p.distance_km} km
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

return (
  <div className="p-4 max-w-md mx-auto pb-10">

    <div className="flex items-center justify-between mb-6">
      <button
        onClick={() => navigate("/")}
        className="border border-gray-300 text-gray-700 px-3 py-2 rounded-full text-sm font-medium transition transform hover:-translate-y-0.5"
      >
        ← Home
      </button>

      <h1 className="text-lg font-semibold text-center flex-1 text-center">
        Manage Presets
      </h1>

      <div className="w-[70px]"></div>
    </div>

      {renderGroup("Run Presets", runPresets)}
      {renderGroup("Ride Presets", ridePresets)}

      <Link
        to="/presets/new"
        className="bg-amber-300 border border-amber-400 text-black w-full block text-center py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
      >
        + Add Preset
      </Link>
    </div>
  );
}

