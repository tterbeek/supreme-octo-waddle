import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Dumbbell,
  Link2,
  Users,
} from "lucide-react";
import ModalSheet from "../components/ModalSheet";
import FormPage from "../components/forms/FormPage";
import { FormActions } from "../components/forms/FormLayout";
import { allowFormNavigation } from "../lib/formLifecycle";
import CompanionSettings from "../components/CompanionSettings";
import { fetchCompanionAccess } from "../services/companion.service";
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
  badge?: string;
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
  badge,
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
      aria-label={label}
      className="block w-full disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RowShell destructive={destructive} className={`min-h-[56px] ${className ?? ""}`}>
        <div className="flex w-full items-center gap-3">
          <RowIcon icon={icon} />
          <span className="flex-1 text-[16px] font-medium">{label}</span>
          {badge && <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium">{badge}</span>}
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
      aria-label={label}
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
      aria-label={label}
      aria-pressed={selected}
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
  const [showDeleteAccountSheet, setShowDeleteAccountSheet] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [showUnitsSheet, setShowUnitsSheet] = useState(false);
  const [showCompanionSheet, setShowCompanionSheet] = useState(false);
  const [companionAllowed, setCompanionAllowed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetchCompanionAccess().then((allowed) => { if (!cancelled) setCompanionAllowed(allowed); })
      .catch(() => { if (!cancelled) setCompanionAllowed(false); });
    return () => { cancelled = true; };
  }, []);
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
    setUnitError(null);
    setUnitSystem(unit);
    setSavingUnit(true);

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
      setShowUnitsSheet(false);
    } catch (err: any) {
      console.error("[Settings] Failed to update unit preference:", err?.message || err);
      setUnitSystem(previous);
      setUnitError("Couldn't save the unit preference. Please try again.");
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
        setExportMessage("No activities to export yet.");
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
      setExportMessage("Could not export your data.");
    }

    setExporting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleDeleteAccount = async () => {
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
    allowFormNavigation(() => { window.location.href = mailto; });
    setDeleting(false);
    setShowDeleteAccountSheet(false);
  };

  const handleRestartOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("movenotes_onboarding_done");
    }
    window.location.href = "/";
  };

  return (
    <>
      <FormPage title="Settings" backTo="/">
        {exportMessage && <p role="status" className="mn-help">{exportMessage}</p>}

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
            <ActionRow label="Weekly Companion" badge="Premium" disabled={!companionAllowed} onClick={() => setShowCompanionSheet(true)} />
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
              onClick={() => setShowDeleteAccountSheet(true)}
              disabled={deleting}
              destructive
            />
          </div>

          <div className="space-y-1.5">
            <ActionRow label="Log out" onClick={handleLogout} />
          </div>
        </div>
      </FormPage>

      {showCompanionSheet && <CompanionSettings onClose={() => setShowCompanionSheet(false)} />}
      {showDeleteAccountSheet && <ModalSheet title="Request account deletion" presentation="dialog" busy={deleting} onClose={() => setShowDeleteAccountSheet(false)}>
        <p>We’ll open your mail app so you can request deletion by email. Nothing is deleted here.</p>
        <FormActions><button type="button" onClick={() => void handleDeleteAccount()} disabled={deleting}>{deleting ? "Opening mail…" : "Open mail app"}</button></FormActions>
      </ModalSheet>}
      {showUnitsSheet ? (
        <ModalSheet title="Units" busy={savingUnit} onClose={() => setShowUnitsSheet(false)} sheetClassName="max-w-md">
          <div className="px-1 pb-2">
            {unitError && <p role="alert" className="mn-error">{unitError}</p>}
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
