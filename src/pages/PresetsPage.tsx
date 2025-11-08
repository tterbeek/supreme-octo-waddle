import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Zap, Footprints, Bike } from "lucide-react";
import type { Preset } from "../types";
import PresetForm from "../components/PresetForm";



export default function PresetsPage() {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [edit, setEdit] = useState<
    Record<string, { name: string; distance: string; effort: number }>
  >({});

const [showForm, setShowForm] = useState(false);
const [newType, setNewType] = useState<"run" | "ride" | null>(null);

const openForm = (type: "run" | "ride") => {
  setNewType(type);
  setShowForm(true);
};


  // Load presets
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
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      setPresets(data || []);

      // Initialize editable copy
      const obj: Record<string, { name: string; distance: string; effort: number }> = {};
      (data || []).forEach((p) => {
        obj[p.id] = {
          name: p.name ?? "",
          distance: String(p.distance_km ?? ""),
          effort: p.effort ?? 3,
        };
      });
      setEdit(obj);
    };

    load();
  }, []);

  // Update local edit state
  const setField = (id: string, field: "name" | "distance" | "effort", value: any) => {
    setEdit((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // Save changes
  const save = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const updates = Object.entries(edit).map(([id, e]) => ({
      id,
      user_id: user.id,
      name: e.name,
      distance_km: e.distance === "" ? null : Number(e.distance),
      effort: e.effort ?? 3,
    }));

    await supabase.from("presets").upsert(updates, { onConflict: "id" });
    navigate("/");
  };

  // Delete preset
  const del = async (id: string) => {
    await supabase.from("presets").delete().eq("id", id);
    setPresets((prev) => prev.filter((p) => String(p.id) !== id));
  };

  // ✅ Proper return block
  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate("/")} className="text-sm underline">
          ← Back
        </button>
        <h1 className="text-lg font-bold">Manage Presets</h1>
        <div className="w-10" />
      </div>
{/* Add Preset Buttons */}
<h2 className="text-sm font-medium text-gray-500 mb-2 mt-2">Add Preset</h2>

<div className="flex gap-4 mb-6">
  <button
    onClick={() => openForm("run")}
    className="flex-1 bg-amber-300 border border-amber-400 text-black py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
  >
    <span className="text-xl">+</span>
    <Footprints className="w-5 h-5" />
    <span>Run</span>
  </button>

  <button
    onClick={() => openForm("ride")}
    className="flex-1 bg-amber-300 border border-amber-400 text-black py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
  >
    <span className="text-xl">+</span>
    <Bike className="w-5 h-5" />
    <span>Ride</span>
  </button>
</div>

      {presets.length === 0 && (
        <p className="text-gray-500 text-sm mb-4">No presets yet</p>
      )}

      {/* --- RUNNING GROUP --- */}
      {presets.filter((p) => p.type === "run").length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Footprints className="w-5 h-5 text-black opacity-80" />
            <span>RUN</span>
          </h2>

          {presets
            .filter((p) => p.type === "run")
            .map((p) => (
              <div
                key={p.id}
                className="border rounded-lg p-4 mb-3 bg-white shadow-sm"
              >
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-gray-600">Name</label>
                  <button
                    onClick={() => del(String(p.id))}
                    className="text-xs text-red-500 underline"
                  >
                    Delete
                  </button>
                </div>

                <input
                  type="text"
                  value={edit[p.id]?.name ?? ""}
                  onChange={(e) => setField(String(p.id), "name", e.target.value)}
                  className="w-full border rounded-md p-2 mb-3 text-sm"
                />

                {/* Distance */}
                <label className="block text-xs text-gray-600 mb-1">
                  Distance (km)
                </label>
                <input
                  type="number"
                  value={edit[p.id]?.distance ?? ""}
                  onChange={(e) =>
                    setField(String(p.id), "distance", e.target.value)
                  }
                  className="w-full border rounded-md p-2 mb-3 text-sm"
                />

                {/* Effort */}
                <label className="block text-xs text-gray-600 mb-1">
                  Effort
                </label>
                <div className="flex justify-between max-w-xs mb-3">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setField(String(p.id), "effort", val)}
                      className={`transition transform active:scale-95 ${
                        edit[p.id]?.effort === val ? "scale-110" : ""
                      }`}
                    >
                      <Zap
                        className={`w-5 h-5 ${
                          val <= (edit[p.id]?.effort ?? 0)
                            ? "text-amber-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* --- DIVIDER --- */}
      <hr className="border-t border-gray-300 my-4" />

      {/* --- CYCLING GROUP --- */}
      {presets.filter((p) => p.type === "ride").length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Bike className="w-5 h-5 text-black opacity-80" />
            <span>RIDE</span>
          </h2>

          {presets
            .filter((p) => p.type === "ride")
            .map((p) => (
              <div
                key={p.id}
                className="border rounded-lg p-4 mb-3 bg-white shadow-sm"
              >
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-gray-600">Name</label>
                  <button
                    onClick={() => del(String(p.id))}
                    className="text-xs text-red-500 underline"
                  >
                    Delete
                  </button>
                </div>

                <input
                  type="text"
                  value={edit[p.id]?.name ?? ""}
                  onChange={(e) => setField(String(p.id), "name", e.target.value)}
                  className="w-full border rounded-md p-2 mb-3 text-sm"
                />

                {/* Distance */}
                <label className="block text-xs text-gray-600 mb-1">
                  Distance (km)
                </label>
                <input
                  type="number"
                  value={edit[p.id]?.distance ?? ""}
                  onChange={(e) =>
                    setField(String(p.id), "distance", e.target.value)
                  }
                  className="w-full border rounded-md p-2 mb-3 text-sm"
                />

                {/* Effort */}
                <label className="block text-xs text-gray-600 mb-1">
                  Effort
                </label>
                <div className="flex justify-between max-w-xs mb-3">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setField(String(p.id), "effort", val)}
                      className={`transition transform active:scale-95 ${
                        edit[p.id]?.effort === val ? "scale-110" : ""
                      }`}
                    >
                      <Zap
                        className={`w-5 h-5 ${
                          val <= (edit[p.id]?.effort ?? 0)
                            ? "text-amber-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* --- ACTION BUTTONS --- */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => navigate("/")}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-full text-sm font-medium"
        >
          Cancel
        </button>

        <button
          onClick={save}
          className="flex-1 bg-amber-300 border border-amber-400 text-black py-2 rounded-full text-sm font-medium transition transform hover:-translate-y-0.5"
        >
          Save
        </button>
      </div>
      {showForm && newType && (
  <PresetForm
    type={newType}
    onClose={() => setShowForm(false)}
    onAdded={() => {
      setShowForm(false);
      // refresh presets
      window.location.reload();
    }}
  />
)}

    </div>
  );
}
