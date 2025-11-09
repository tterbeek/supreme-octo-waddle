import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

type Period = "week" | "month" | "year";
type Sport = "run" | "ride";

export default function GoalsPage() {
  const navigate = useNavigate();
  const [edit, setEdit] = useState<Record<string, string>>({
    "run-week": "",
    "run-month": "",
    "run-year": "",
    "ride-week": "",
    "ride-month": "",
    "ride-year": "",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id);

      const updated = { ...edit };
      (data || []).forEach((g) => {
        updated[`${g.type}-${g.period}`] = g.distance_km === null ? "" : String(g.distance_km);
      });

      setEdit(updated);
    };

    load();
  }, []);

  const update = (type: Sport, period: Period, value: string) => {
    setEdit((prev) => ({
      ...prev,
      [`${type}-${period}`]: value
    }));
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates = Object.entries(edit).map(([key, value]) => {
      const [type, period] = key.split("-") as [Sport, Period];
      return {
        user_id: user.id,
        type,
        period,
        distance_km: value === "" ? null : Number(value),
      };
    });

    await supabase
      .from("goals")
      .upsert(updates, { onConflict: "user_id,type,period" });

    navigate("/");
  };

  const Field = (type: Sport, period: Period) => (
    <div key={`${type}-${period}`} className="flex items-center justify-between border rounded-lg px-3 py-2 mb-2 bg-white">
      <span className="capitalize text-gray-700 text-sm">{period} goal</span>

      <div className="flex items-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={edit[`${type}-${period}`]}
          onChange={(e) => update(type, period, e.target.value)}
          className="w-20 border rounded-md p-1 text-right text-sm"
        />
        <span className="text-gray-500 text-sm ml-1">km</span>
      </div>
    </div>
  );

  const Section = (label: string, type: Sport) => (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 mb-2">{label}</h2>
      {(["week", "month", "year"] as Period[]).map((p) => Field(type, p))}
    </div>
  );

  return (
    <div className="p-4 max-w-md mx-auto">

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate("/")} className="text-sm underline">
          ← Back
        </button>
        <h1 className="text-lg font-bold">Goals</h1>
        <div className="w-10" />
      </div>

      {Section("RUNNING", "run")}
      {Section("CYCLING", "ride")}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => navigate("/")}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-full text-sm font-medium"
        >
          Cancel
        </button>

        <button
          onClick={save}
          className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-2 rounded-full text-sm font-medium transition transform hover:-translate-y-0.5 active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  );
}
