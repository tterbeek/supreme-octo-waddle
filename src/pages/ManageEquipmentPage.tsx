import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import type { Equipment } from "../types";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { fetchActivityPreferences } from "../lib/fetchActivityPreferences";
import { useUnitSystem } from "../contexts/UnitContext";
import { kmToMiles } from "../lib/units";
import { formatDurationMinutes } from "../lib/units";
import EquipmentFormSheet from "../components/EquipmentFormSheet";
import ModalSheet from "../components/ModalSheet";
import {
  createEquipment,
  fetchAllEquipment,
  setEquipmentActive,
  updateEquipment,
} from "../services/equipment.service";

type Metric = "distance" | "duration";

type PreferenceMap = Record<string, Metric>;

type ActivityRow = {
  type: string;
  date: string;
  distance_km: number | null;
  duration_min: number | null;
  activity_equipment?: Array<{ equipment_id?: string | null } | null> | null;
};

type UsageByType = {
  count: number;
  distanceKm: number;
  durationMin: number;
  firstUseDate: string | null;
};

type EquipmentUsage = {
  byType: Record<string, UsageByType>;
  firstUseDate: string | null;
};

const TYPE_NOUNS: Record<string, string> = {
  run: "run",
  walk: "walk",
  ride: "ride",
  hike: "hike",
  swim: "swim",
  strength: "strength session",
  yoga: "yoga session",
  restore: "restore session",
  other: "session",
};

const buildPreferenceMap = (
  prefs: { activity_type: string; default_metric: Metric }[]
): PreferenceMap => Object.fromEntries(prefs.map((pref) => [pref.activity_type, pref.default_metric]));

const toDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (dateStr?: string | null) => {
  const date = toDate(dateStr);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const pickEarliestDate = (a?: string | null, b?: string | null) => {
  const dateA = toDate(a);
  const dateB = toDate(b);
  if (!dateA) return b ?? null;
  if (!dateB) return a ?? null;
  return dateA <= dateB ? a ?? null : b ?? null;
};

const formatApproxSince = (dateStr: string) => {
  const date = toDate(dateStr);
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "about 1 day";
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays >= 365) {
    const years = Math.round(diffDays / 365);
    return `about ${years} ${years === 1 ? "year" : "years"}`;
  }
  if (diffDays >= 30) {
    const months = Math.round(diffDays / 30);
    return `about ${months} ${months === 1 ? "month" : "months"}`;
  }
  if (diffDays >= 7) {
    const weeks = Math.round(diffDays / 7);
    return `about ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }

  return `about ${diffDays} ${diffDays === 1 ? "day" : "days"}`;
};

const formatApproxDistance = (km: number, unitSystem: "metric" | "imperial") => {
  const value = unitSystem === "imperial" ? kmToMiles(km) : km;
  const rounded = Math.round(value);
  if (rounded < 1) return "";
  const unit = unitSystem === "imperial" ? "mi" : "km";
  return `about ${rounded} ${unit}`;
};

const formatApproxDuration = (minutes: number) => {
  if (minutes <= 0) return "";
  const formatted = formatDurationMinutes(minutes);
  return formatted ? `about ${formatted}` : "";
};

const pluralize = (noun: string, count: number) => {
  if (count === 1) return noun;
  const parts = noun.split(" ");
  const word = parts[parts.length - 1];
  let plural = `${word}s`;
  if (word.endsWith("y")) plural = `${word.slice(0, -1)}ies`;
  if (word.endsWith("s")) plural = `${word}es`;
  return [...parts.slice(0, -1), plural].join(" ");
};

const buildUsageMap = (activities: ActivityRow[]) => {
  const map: Record<string, EquipmentUsage> = {};

  activities.forEach((activity) => {
    const equipmentLinks = activity.activity_equipment || [];
    if (!equipmentLinks.length) return;

    equipmentLinks.forEach((link) => {
      const equipmentId = link?.equipment_id;
      if (!equipmentId) return;

      const type = activity.type || "other";
      const usage = map[equipmentId] || { byType: {}, firstUseDate: null };
      const current = usage.byType[type] || {
        count: 0,
        distanceKm: 0,
        durationMin: 0,
        firstUseDate: null,
      };

      current.count += 1;
      if (Number(activity.distance_km) > 0) {
        current.distanceKm += Number(activity.distance_km);
      }
      if (Number(activity.duration_min) > 0) {
        current.durationMin += Number(activity.duration_min);
      }

      current.firstUseDate = pickEarliestDate(current.firstUseDate, activity.date);
      usage.byType[type] = current;
      usage.firstUseDate = pickEarliestDate(usage.firstUseDate, activity.date);
      map[equipmentId] = usage;
    });
  });

  return map;
};

const getSystemDefaultMetric = (activityType: string): Metric => {
  const config = ACTIVITY_TYPES[activityType];
  if (!config || !config.defaultFields.length) return "duration";
  return config.defaultFields[0] === "distance_km" ? "distance" : "duration";
};

const getTypeConfig = (type: string) => ACTIVITY_TYPES[type] ?? ACTIVITY_TYPES["other"];

export default function ManageEquipmentPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, EquipmentUsage>>({});
  const [preferences, setPreferences] = useState<PreferenceMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [savingStop, setSavingStop] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const { unitSystem } = useUnitSystem();

  const typeOrder = useMemo(() => {
    const order: Record<string, number> = {};
    Object.values(ACTIVITY_TYPES).forEach((type, index) => {
      order[type.id] = index;
    });
    return order;
  }, []);

  const sortTypes = (types: string[]) =>
    types.slice().sort((a, b) => {
      const orderA = typeOrder[a] ?? 999;
      const orderB = typeOrder[b] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (!cancelled) {
          setError("Please sign in to manage equipment.");
          setLoading(false);
        }
        return;
      }

      setUserId(user.id);

      try {
        const [equipmentList, activitiesRes] = await Promise.all([
          fetchAllEquipment(user.id),
          supabase
            .from("activities")
            .select(
              "type, date, distance_km, duration_min, activity_equipment:activity_equipment (equipment_id)"
            )
            .eq("user_id", user.id),
        ]);

        if (activitiesRes.error) throw activitiesRes.error;

        let prefMap: PreferenceMap = {};
        try {
          const prefs = await fetchActivityPreferences(supabase, user.id);
          prefMap = buildPreferenceMap(prefs);
        } catch (prefError: any) {
          console.error(
            "[Equipment] Preferences load error:",
            prefError?.message || prefError
          );
        }

        if (!cancelled) {
          setEquipment(equipmentList);
          setUsageMap(buildUsageMap((activitiesRes.data || []) as ActivityRow[]));
          setPreferences(prefMap);
        }
      } catch (err: any) {
        console.error("[Equipment] Load error:", err?.message || err);
        if (!cancelled) {
          setError("Could not load equipment. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEquipment = equipment.find((item) => item.id === selectedId) || null;
  const selectedUsage = selectedEquipment ? usageMap[selectedEquipment.id] : null;
  const selectedUsageTypes = selectedUsage
    ? sortTypes(Object.keys(selectedUsage.byType))
    : [];
  const isSelectedUnused = selectedEquipment ? selectedUsageTypes.length === 0 : true;
  const selectedFirstUseDate = selectedUsage?.firstUseDate || selectedEquipment?.created_at || null;
  const selectedInUseSince = selectedFirstUseDate ? formatDate(selectedFirstUseDate) : "";
  const selectedInUseAbout = selectedFirstUseDate ? formatApproxSince(selectedFirstUseDate) : "";
  const selectedAddedDate = selectedEquipment ? formatDate(selectedEquipment.created_at) : "";

  useEffect(() => {
    if (!selectedEquipment) {
      setEditName("");
      setEditNotes("");
      setSaveError(null);
      setShowStopConfirm(false);
      return;
    }

    setEditName(selectedEquipment.name);
    setEditNotes(selectedEquipment.notes || "");
    setSaveError(null);
    setShowStopConfirm(false);
  }, [selectedEquipment?.id]);

  const renderTypeLine = (types: string[], textClassName = "text-gray-600") => (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${textClassName}`}>
      {types.map((type, index) => {
        const config = getTypeConfig(type);
        const Icon = config.Icon;
        const label = config.equipmentLabel || config.label || type;

        return (
          <span key={type} className="inline-flex items-center gap-1 text-gray-500">
            <Icon size={16} strokeWidth={1.7} />
            <span>{label}</span>
            {index < types.length - 1 && <span className="text-gray-400">·</span>}
          </span>
        );
      })}
    </div>
  );

  const getPrimaryMetric = (activityType: string) =>
    preferences[activityType] ?? getSystemDefaultMetric(activityType);

  const handleAddEquipment = async (name: string, notes: string) => {
    if (!userId) return { ok: false, error: "Please sign in again." };
    const notesValue = notes ? notes : null;
    const { equipment: created } = await createEquipment({
      userId,
      name,
      notes: notesValue || undefined,
    });

    if (!created) {
      return { ok: false, error: "Could not add equipment right now." };
    }

    setEquipment((prev) => [created, ...prev]);
    return { ok: true };
  };

  const handleSaveChanges = async () => {
    if (!selectedEquipment) return;
    if (!editName.trim()) {
      setSaveError("Name is required.");
      return;
    }

    setSavingChanges(true);
    setSaveError(null);

    const notesValue = editNotes.trim() ? editNotes.trim() : null;
    const { equipment: updated, error: updateError } = await updateEquipment(
      selectedEquipment.id,
      {
        name: editName.trim(),
        notes: notesValue,
      }
    );

    if (updateError || !updated) {
      setSaveError("Could not save changes right now.");
      setSavingChanges(false);
      return;
    }

    setEquipment((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setSavingChanges(false);
    setSelectedId(null);
  };

  const handleStopUsing = async () => {
    if (!selectedEquipment) return;
    setSavingStop(true);
    const { equipment: updated } = await setEquipmentActive(selectedEquipment.id, false);
    if (updated) {
      setEquipment((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setShowStopConfirm(false);
    }
    setSavingStop(false);
  };

  return (
    <div className={`mb-4 ${embedded ? "px-6 pb-8" : ""}`}>
      {!embedded && (
        <>
          <div className="relative flex items-center justify-center">
            <h1 className="text-lg font-bold text-gray-600 text-center">
              Manage equipment
            </h1>
          </div>
          <p className="text-sm text-gray-500 text-center mt-1 mb-4">
            Things you move with
          </p>
        </>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading equipment...</div>
      ) : equipment.length === 0 ? (
        <p className="text-sm text-gray-500">
          No equipment yet. Add your first item above.
        </p>
      ) : (
        <div>
          {equipment.map((item) => {
            const usage = usageMap[item.id];
            const usageTypes = usage ? sortTypes(Object.keys(usage.byType)) : [];
            const hasUsage = usageTypes.length > 0;
            const firstUseDate = usage?.firstUseDate || null;
            const sinceDate = firstUseDate ? formatDate(firstUseDate) : "";

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="border border-warm-200 rounded-lg p-4 mb-3 bg-warm-100 shadow-sm text-left w-full"
              >
                <div className="text-base font-semibold text-gray-800">
                  {item.name}
                </div>
                {hasUsage ? (
                  <div className="mt-1">{renderTypeLine(usageTypes)}</div>
                ) : (
                  <div className="text-sm text-gray-500 mt-1">Not used yet</div>
                )}
                {hasUsage && sinceDate && (
                  <div className="text-xs text-gray-500 mt-1">
                    Since {sinceDate}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        aria-label="Add equipment"
        onClick={() => setShowAddForm(true)}
        className={`rounded-full bg-movenotes-primary text-primary-text shadow-lg shadow-movenotes-primary/30 active:scale-95 transition flex items-center justify-center gap-2 text-lg px-4 h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-movenotes-primary ${
          embedded ? "w-full mt-4" : "fixed z-40"
        }`}
        style={
          embedded
            ? undefined
            : {
                right: "calc(16px + env(safe-area-inset-right))",
                bottom: "calc(90px + env(safe-area-inset-bottom))",
              }
        }
      >
        <span className="text-2xl leading-none">+</span>
        <span className="text-sm font-semibold">Add equipment</span>
      </button>

      {showAddForm && (
        <EquipmentFormSheet
          title="Add new equipment"
          primaryLabel="Add equipment"
          savingLabel="Adding..."
          onSubmit={handleAddEquipment}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {selectedEquipment && (
        <ModalSheet
          onClose={() => setSelectedId(null)}
          enableDragToClose
          sheetClassName="max-w-md max-h-[calc(90vh+50px)] overflow-y-auto"
        >
          <h2 className="text-lg font-semibold text-center mb-4">Edit equipment</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-700">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-warm-200 rounded-lg p-3 mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Notes (optional)</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full border border-warm-200 rounded-lg p-3 mt-1 resize-none"
                placeholder="Anything you want to remember about this."
              />
            </div>
          </div>

          <div className="space-y-4 mt-5">
            {isSelectedUnused ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-warm-200 bg-warm-50 px-4 py-3">
                  <div className="text-xs uppercase text-gray-500">Status</div>
                  <div className="text-base font-semibold text-gray-800">
                    Not used yet
                  </div>
                </div>
                {selectedAddedDate && (
                  <div className="rounded-xl border border-warm-200 bg-warm-50 px-4 py-3">
                    <div className="text-xs uppercase text-gray-500">Added</div>
                    <div className="text-sm text-gray-700">{selectedAddedDate}</div>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  Activity types and usage will appear here once you use this.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="text-xs uppercase text-gray-500 mb-1">Used for</div>
                  {renderTypeLine(selectedUsageTypes, "text-gray-800")}
                </div>
                {selectedInUseSince && (
                  <div>
                    <div className="text-xs uppercase text-gray-500 mb-1">
                      In use since
                    </div>
                    <div className="text-sm text-gray-700">
                      {selectedInUseSince} {selectedInUseAbout ? `· ${selectedInUseAbout}` : ""}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs uppercase text-gray-500 mb-2">
                    Usage summary
                  </div>
                  <div className="space-y-3">
                    {selectedUsageTypes.map((type) => {
                      const stats = selectedUsage?.byType[type];
                      if (!stats || stats.count <= 0) return null;
                      const config = getTypeConfig(type);
                      const Icon = config.Icon;
                      const label = config.equipmentLabel || config.label || type;
                      const noun = TYPE_NOUNS[type] || "session";
                      const countLine = `${stats.count} ${pluralize(noun, stats.count)}`;
                      const metric = getPrimaryMetric(type);
                      const metricValue =
                        metric === "distance"
                          ? formatApproxDistance(stats.distanceKm, unitSystem)
                          : formatApproxDuration(stats.durationMin);
                      const detailLine = metricValue
                        ? `${countLine} · ${metricValue}`
                        : countLine;

                      return (
                        <div
                          key={type}
                          className="rounded-xl border border-warm-200 bg-warm-50 px-4 py-3"
                        >
                          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <span className="text-gray-500">
                              <Icon size={16} strokeWidth={1.7} />
                            </span>
                            <span>{label}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{detailLine}</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    These numbers are approximations based on your activity notes.
                  </p>
                </div>
              </div>
            )}
          </div>

          {saveError && <p className="text-sm text-red-600 mt-3">{saveError}</p>}

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={savingChanges}
            className="bg-movenotes-primary text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5 disabled:opacity-50 mt-5"
          >
            {savingChanges ? "Saving..." : "Save changes"}
          </button>

          {selectedEquipment.is_active && (
            <button
              type="button"
              onClick={() => setShowStopConfirm(true)}
              className="w-full mt-3 py-3 border border-movenotes-accent text-movenotes-accent rounded-full text-sm font-medium hover:bg-movenotes-accent/10 transition"
            >
              Stop using this equipment
            </button>
          )}
        </ModalSheet>
      )}

      {showStopConfirm && (
        <ModalSheet onClose={() => setShowStopConfirm(false)} enableDragToClose>
          <h3 className="text-lg font-semibold text-center mb-2">
            Stop using this equipment
          </h3>
          <p className="text-sm text-gray-600 text-center mb-6">
            This won&apos;t affect past activities.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStopUsing}
              disabled={savingStop}
              className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-2 rounded-full font-medium disabled:opacity-60"
            >
              {savingStop ? "Stopping..." : "Stop using this equipment"}
            </button>
            <button
              type="button"
              onClick={() => setShowStopConfirm(false)}
              className="px-4 py-2 rounded-full border border-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </ModalSheet>
      )}
    </div>
  );
}
