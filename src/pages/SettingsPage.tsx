// src/pages/SettingsPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Download, LogOut, Trash2, FileText } from "lucide-react";
import { useUnitSystem } from "../contexts/UnitContext";

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const { unitSystem, setUnitSystem } = useUnitSystem();

  const updateUnit = async (unit: "metric" | "imperial") => {
    if (unit === unitSystem) return;
    const previous = unitSystem;
    setUnitSystem(unit);
    setSavingUnit(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          unit_system: unit,
        });
      if (error) throw error;
    } catch (err: any) {
      console.error("[Settings] Failed to update unit preference:", err?.message || err);
      setUnitSystem(previous);
    } finally {
      setSavingUnit(false);
    }
  };

  // --------------------------------------
  // EXPORT CSV
  // --------------------------------------
  const handleExport = async () => {
    setExporting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert("No activities to export yet.");
        setExporting(false);
        return;
      }

      const header = Object.keys(data[0] || {}).join(",");
      const rows = data
        .map((row) =>
          Object.values(row)
            .map((val) => JSON.stringify(val ?? "")) // safe CSV
            .join(",")
        )
        .join("\n");

      const csv = [header, rows].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "movenotes-export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Could not export your data.");
    }

    setExporting(false);
  };

  // --------------------------------------
  // LOGOUT
  // --------------------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // --------------------------------------
  // DELETE ACCOUNT
  // --------------------------------------
  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      "Request deletion via email? We’ll open your mail app to confirm."
    );
    if (!confirmed) return;

    setDeleting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email || "";
    const mailto = `mailto:info@movenotes.app?subject=${encodeURIComponent(
      "Account deletion request"
    )}&body=${encodeURIComponent(
      `Please delete my MoveNotes account associated with ${email || "this email"}.`
    )}`;
    window.location.href = mailto;
    setDeleting(false);
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Settings</h1>

      {/* UNIT PREFERENCE */}
      <div className="w-full bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4">
        <h3 className="text-sm font-medium text-gray-800 mb-2">Units</h3>
        <div className="flex flex-col gap-2 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-movenotes-primary"
              checked={unitSystem === "metric"}
              onChange={() => updateUnit("metric")}
              disabled={savingUnit}
            />
            <span>Metric (km)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-movenotes-primary"
              checked={unitSystem === "imperial"}
              onChange={() => updateUnit("imperial")}
              disabled={savingUnit}
            />
            <span>Imperial (miles)</span>
          </label>
        </div>
      </div>

      {/* MANAGE PRESETS */}
      <Link
        to="/presets"
        className="w-full flex items-center gap-3 bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4 active:scale-95"
      >
        <FileText className="w-5 h-5 text-movenotes-primary" />
        <span>Manage Presets</span>
      </Link>

      {/* ACTIVITY PREFERENCES */}
      <Link
        to="/settings/activity-preferences"
        className="w-full flex items-center gap-3 bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4 active:scale-95"
      >
        <FileText className="w-5 h-5 text-movenotes-primary" />
        <span>Activity Preferences</span>
      </Link>

      {/* EXPORT */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full flex items-center gap-3 bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4 active:scale-95"
      >
        <Download className="w-5 h-5 text-movenotes-primary" />
        <span>{exporting ? "Exporting..." : "Export My Data"}</span>
      </button>

      {/* DELETE ACCOUNT */}
      <button
        onClick={handleDeleteAccount}
        disabled={deleting}
        className="w-full flex items-center gap-3 bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4 text-movenotes-text active:scale-95 disabled:opacity-70"
      >
        <Trash2 className="w-5 h-5 text-movenotes-primary" />
        <span>{deleting ? "Opening mail…" : "Request Account Deletion"}</span>
      </button>

      {/* LOGOUT */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-8 active:scale-95"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>

      {/* Legal Links */}
      <div className="text-sm text-gray-600 flex flex-col gap-2">
        <a href="/privacy" className="flex items-center gap-2 underline">
          <FileText size={16} /> Privacy Policy
        </a>
        <a href="/terms" className="flex items-center gap-2 underline">
          <FileText size={16} /> Terms of Service
        </a>
      </div>

    </div>
  );
}
