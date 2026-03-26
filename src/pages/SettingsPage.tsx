import { useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Dumbbell,
  Link2,
  Users,
} from "lucide-react";
import ModalSheet from "../components/ModalSheet";
import { supabase } from "../supabaseClient";
import { useUnitSystem } from "../contexts/UnitContext";

type UnitSystem = "metric" | "imperial";

type BaseRowProps = {
  children: ReactNode;
  className?: string;
  destructive?: boolean;
};

type ActionRowProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
};

type LinkRowProps = {
  label: string;
  to: string;
  icon?: ComponentType<{ className?: string }>;
};

type InlineSettingRowProps = {
  label: string;
  value: string;
  onClick?: () => void;
  disabled?: boolean;
};

const rowBaseClassName =
  "group flex w-full items-center rounded-[14px] px-4 text-left transition-colors duration-150 hover:bg-[#F6F0E7] active:bg-[#EFE8DE]";

function RowShell({
  children,
  className = "",
  destructive = false,
}: BaseRowProps) {
  return (
    <div
      className={`${rowBaseClassName} ${destructive ? "text-[#D64545]" : "text-[#1F2A24]"} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function RowIcon({ icon: Icon }: { icon?: ComponentType<{ className?: string }> }) {
  if (!Icon) return null;
  return <Icon className="h-5 w-5 shrink-0 text-[#6F8A7E]" />;
}

function ActionRow({
  label,
  onClick,
  disabled = false,
  destructive = false,
  icon,
  className,
}: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RowShell destructive={destructive} className={`min-h-[56px] ${className ?? ""}`}>
        <div className="flex w-full items-center gap-3">
          <RowIcon icon={icon} />
          <span className="flex-1 text-[16px] font-medium">{label}</span>
        </div>
      </RowShell>
    </button>
  );
}

function NavigationRow({ label, to, icon }: LinkRowProps) {
  return (
    <Link to={to} className="block w-full">
      <RowShell className="min-h-[56px]">
        <div className="flex w-full items-center gap-3">
          <RowIcon icon={icon} />
          <span className="flex-1 text-[16px] font-medium">{label}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#9AA39D] transition-transform duration-150 group-active:translate-x-0.5" />
        </div>
      </RowShell>
    </Link>
  );
}

function InlineSettingRow({
  label,
  value,
  onClick,
  disabled = false,
}: InlineSettingRowProps) {
  const content = (
    <div className="flex w-full items-center gap-4">
      <span className="min-w-0 flex-1 text-[16px] font-medium text-[#1F2A24]">
        {label}
      </span>
      <span className="text-right text-[15px] font-normal text-[#6B746E]">
        {value}
      </span>
      {onClick ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[#9AA39D] transition-transform duration-150 group-active:translate-x-0.5" />
      ) : null}
    </div>
  );

  if (!onClick) {
    return <RowShell className="min-h-[52px]">{content}</RowShell>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RowShell className="min-h-[52px]">{content}</RowShell>
    </button>
  );
}

function UnitOption({
  label,
  description,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors duration-150 ${
        selected
          ? "border-[#C9D5CE] bg-[#EEF3F0]"
          : "border-[#E6DED1] bg-[#F8F3EB] hover:bg-[#F4EDE3] active:bg-[#EFE8DE]"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-medium text-[#1F2A24]">{label}</div>
        <div className="mt-1 text-[14px] text-[#6B746E]">{description}</div>
      </div>
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          selected ? "border-[#5A7A69] bg-[#5A7A69]" : "border-[#CBBEAB] bg-transparent"
        }`}
      >
        {selected ? <Check className="h-3 w-3 text-white" /> : null}
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [showUnitsSheet, setShowUnitsSheet] = useState(false);
  const { unitSystem, setUnitSystem } = useUnitSystem();

  const unitLabel =
    savingUnit
      ? "Saving..."
      : unitSystem === "imperial"
      ? "Imperial (mi)"
      : "Metric (km)";

  const updateUnit = async (unit: UnitSystem) => {
    if (unit === unitSystem) {
      setShowUnitsSheet(false);
      return;
    }

    const previous = unitSystem;
    setUnitSystem(unit);
    setSavingUnit(true);
    setShowUnitsSheet(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase.from("user_preferences").upsert({
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
            .map((val) => JSON.stringify(val ?? ""))
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

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

  const handleRestartOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("movenotes_onboarding_done");
    }
    window.location.href = "/";
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[24rem] px-0 pb-6 pt-[18px]">
        <h1 className="text-[28px] font-semibold leading-none text-[#1F2A24]">
          Settings
        </h1>

        <div className="mt-5 space-y-5">
          <div className="space-y-1.5">
            <ActionRow label="Restart onboarding" onClick={handleRestartOnboarding} />
          </div>

          <div className="space-y-1.5">
            <NavigationRow
              label="Activity preferences"
              to="/settings/activity-preferences"
            />
            <NavigationRow label="Presets" to="/presets" />
          </div>

          <div className="space-y-1.5">
            <InlineSettingRow
              label="Units"
              value={unitLabel}
              onClick={() => setShowUnitsSheet(true)}
              disabled={savingUnit}
            />
          </div>

          <div className="space-y-1.5">
            <NavigationRow label="Equipment" to="/settings/equipment" icon={Dumbbell} />
          </div>

          <div className="space-y-1.5">
            <NavigationRow label="Social circle" to="/settings/circle" icon={Users} />
          </div>

          <div className="space-y-1.5">
            <NavigationRow
              label="External connections"
              to="/settings/connections"
              icon={Link2}
            />
          </div>

          <div className="space-y-1.5">
            <ActionRow
              label={exporting ? "Exporting..." : "Export data"}
              onClick={handleExport}
              disabled={exporting}
            />
            <ActionRow
              label={deleting ? "Opening mail..." : "Delete account"}
              onClick={handleDeleteAccount}
              disabled={deleting}
              destructive
            />
          </div>

          <div className="space-y-1.5">
            <ActionRow label="Log out" onClick={handleLogout} />
          </div>
        </div>
      </div>

      {showUnitsSheet ? (
        <ModalSheet onClose={() => setShowUnitsSheet(false)} sheetClassName="max-w-md">
          <div className="px-1 pb-2">
            <h2 className="text-[22px] font-semibold text-[#1F2A24]">Units</h2>
            <p className="mt-2 text-[15px] text-[#6B746E]">
              Choose how distance is shown throughout MoveNotes.
            </p>
            <div className="mt-5 space-y-3">
              <UnitOption
                label="Metric (km)"
                description="Kilometres for distance-based activities."
                selected={unitSystem === "metric"}
                onClick={() => void updateUnit("metric")}
                disabled={savingUnit}
              />
              <UnitOption
                label="Imperial (mi)"
                description="Miles for distance-based activities."
                selected={unitSystem === "imperial"}
                onClick={() => void updateUnit("imperial")}
                disabled={savingUnit}
              />
            </div>
          </div>
        </ModalSheet>
      ) : null}
    </>
  );
}
