import { useEffect, useMemo, useRef, useState } from "react";
import { IconGripVertical } from "@tabler/icons-react";
import { supabase } from "../supabaseClient";
import ModalSheet from "../components/ModalSheet";
import {
  ACTIVITY_TYPES,
  SETTINGS_ACTIVITY_TYPE_IDS,
  supportsMetricOverride,
} from "../config/activityTypes";
import { fetchActivityPreferences } from "../lib/fetchActivityPreferences";
import {
  setCachedUserActivityTypes,
  type UserActivityTypeRow,
} from "../lib/userActivityTypesCache";

type Metric = "distance" | "duration";
type PreferenceMap = Record<string, Metric>;

const SORT_INCREMENT = 10;

function buildPreferenceMap(
  prefs: { activity_type: string; default_metric: Metric }[]
): PreferenceMap {
  return Object.fromEntries(
    prefs.map((pref) => [pref.activity_type, pref.default_metric])
  );
}

function getSystemDefaultMetric(activityType: string): Metric {
  const config = ACTIVITY_TYPES[activityType];
  if (!config || !config.defaultFields.length) return "duration";

  return config.defaultFields[0] === "distance_km" ? "distance" : "duration";
}

function normalizeActivityTypes(rows: UserActivityTypeRow[]) {
  const rowMap = new Map(rows.map((row) => [row.activity_type, row]));
  return SETTINGS_ACTIVITY_TYPE_IDS.map((id, index) => {
    const existing = rowMap.get(id);
    if (existing) return existing;
    return {
      activity_type: id,
      sort_order: (index + 1) * SORT_INCREMENT,
      is_enabled: true,
    };
  });
}

export default function ActivityPreferencesPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [activityTypes, setActivityTypes] = useState<UserActivityTypeRow[]>([]);
  const [prefs, setPrefs] = useState<PreferenceMap>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMetric, setSavingMetric] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [activeMetricType, setActiveMetricType] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragStartOrderRef = useRef<string[] | null>(null);
  const dragStartStateRef = useRef<UserActivityTypeRow[] | null>(null);
  const touchDragRef = useRef(false);
  const enabledOrderRef = useRef<string[]>([]);

  const enabledActivities = useMemo(
    () =>
      activityTypes
        .filter((row) => row.is_enabled)
        .sort((a, b) => a.sort_order - b.sort_order),
    [activityTypes]
  );

  useEffect(() => {
    enabledOrderRef.current = enabledActivities.map((row) => row.activity_type);
  }, [enabledActivities]);
  const hiddenActivities = useMemo(
    () =>
      activityTypes
        .filter((row) => !row.is_enabled)
        .sort((a, b) => a.sort_order - b.sort_order),
    [activityTypes]
  );

  const activeMetricConfig = activeMetricType
    ? ACTIVITY_TYPES[activeMetricType] ?? ACTIVITY_TYPES["other"]
    : null;
  const activeMetricSelected =
    activeMetricType && supportsMetricOverride(activeMetricType)
      ? prefs[activeMetricType] ?? getSystemDefaultMetric(activeMetricType)
      : null;
  const showMetricModal = Boolean(activeMetricType && activeMetricConfig);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
          setError("Please sign in to manage activity types.");
          setLoading(false);
        }
        return;
      }

      setUserId(user.id);

      try {
        const { error: seedError } = await supabase.rpc(
          "ensure_user_activity_types_seeded"
        );
        if (seedError) throw seedError;

        const [typesRes, prefRows] = await Promise.all([
          supabase
            .from("user_activity_types")
            .select("activity_type, sort_order, is_enabled")
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true }),
          fetchActivityPreferences(supabase, user.id),
        ]);

        if (typesRes.error) throw typesRes.error;

        if (!cancelled) {
          const normalized = normalizeActivityTypes(typesRes.data || []);
          setActivityTypes(normalized);
          setCachedUserActivityTypes(user.id, normalized);
          setPrefs(buildPreferenceMap(prefRows));
        }
      } catch (err: any) {
        console.error("[ActivityPreferences] Fetch error:", err?.message || err);
        if (!cancelled) {
          setError("Could not load activity types. Please try again.");
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

  const applyEnabledOrder = (rows: UserActivityTypeRow[], order: string[]) => {
    const orderMap = new Map(
      order.map((id, index) => [id, (index + 1) * SORT_INCREMENT])
    );
    return rows.map((row) => {
      if (!row.is_enabled) return row;
      const nextOrder = orderMap.get(row.activity_type);
      return nextOrder !== undefined ? { ...row, sort_order: nextOrder } : row;
    });
  };

  const areIdsEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  const commitEnabledOrder = async (
    nextIds: string[],
    fallbackState?: UserActivityTypeRow[] | null
  ) => {
    if (!nextIds.length) return;

    const previous = fallbackState ?? activityTypes;
    const nextRows = applyEnabledOrder(previous, nextIds);
    setActivityTypes(nextRows);
    if (userId) {
      setCachedUserActivityTypes(userId, nextRows);
    }
    setReordering(true);
    setError(null);

    try {
      const { error: reorderError } = await supabase.rpc(
        "reorder_user_activity_types",
        {
          new_order: nextIds,
        }
      );
      if (reorderError) throw reorderError;
    } catch (err: any) {
      console.error("[ActivityPreferences] Reorder error:", err?.message || err);
      setActivityTypes(previous);
      if (userId) {
        setCachedUserActivityTypes(userId, previous);
      }
      setError("Could not reorder activities. Please try again.");
    } finally {
      setReordering(false);
      setDraggingId(null);
      draggingIdRef.current = null;
      setDragOverId(null);
    }
  };

  const updateMetricPreference = async (
    activityType: string,
    choice: Metric
  ) => {
    if (!userId) return;

    const previous = prefs;
    const systemDefault = getSystemDefaultMetric(activityType);
    const shouldClear = choice === systemDefault;

    setSavingMetric(activityType);
    setError(null);

    setPrefs((prev) => {
      const next = { ...prev };
      if (shouldClear) {
        delete next[activityType];
      } else {
        next[activityType] = choice;
      }
      return next;
    });

    try {
      if (shouldClear) {
        const { error: deleteError } = await supabase
          .from("activity_preferences")
          .delete()
          .eq("user_id", userId)
          .eq("activity_type", activityType);
        if (deleteError) throw deleteError;
      } else {
        const { error: saveError } = await supabase
          .from("activity_preferences")
          .upsert(
            {
              user_id: userId,
              activity_type: activityType,
              default_metric: choice,
            },
            { onConflict: "user_id,activity_type" }
          );
        if (saveError) throw saveError;
      }
    } catch (err: any) {
      console.error("[ActivityPreferences] Save error:", err?.message || err);
      setPrefs(previous);
      setError("Could not save metric preference. Please try again.");
    } finally {
      setSavingMetric(null);
    }
  };

  const toggleActivityType = async (row: UserActivityTypeRow) => {
    if (!userId) return;

    const nextEnabled = !row.is_enabled;
    const previous = activityTypes;
    const maxEnabledSort = Math.max(
      0,
      ...previous.filter((item) => item.is_enabled).map((item) => item.sort_order)
    );

    setSavingToggle(row.activity_type);
    setError(null);

    const nextRows = previous.map((item) =>
      item.activity_type === row.activity_type
        ? {
            ...item,
            is_enabled: nextEnabled,
            sort_order: nextEnabled
              ? maxEnabledSort + SORT_INCREMENT
              : item.sort_order,
          }
        : item
    );
    setActivityTypes(nextRows);
    setCachedUserActivityTypes(userId, nextRows);

    try {
      const { error: toggleError } = await supabase.rpc(
        "set_user_activity_type_enabled",
        {
          p_activity_type: row.activity_type,
          p_is_enabled: nextEnabled,
        }
      );
      if (toggleError) throw toggleError;
    } catch (err: any) {
      console.error("[ActivityPreferences] Toggle error:", err?.message || err);
      setActivityTypes(previous);
      setCachedUserActivityTypes(userId, previous);
      setError("Could not update activity type. Please try again.");
    } finally {
      setSavingToggle(null);
    }
  };

  const handleDrop = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      draggingIdRef.current = null;
      setDragOverId(null);
      return;
    }

    const enabled = enabledActivities;
    const fromIndex = enabled.findIndex((row) => row.activity_type === draggingId);
    const toIndex = enabled.findIndex((row) => row.activity_type === targetId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null);
      draggingIdRef.current = null;
      setDragOverId(null);
      return;
    }

    const nextOrder = [...enabled];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);

    const nextIds = nextOrder.map((row) => row.activity_type);
    await commitEnabledOrder(nextIds, dragStartStateRef.current);
  };

  return (
    <>
      <div className={`px-6 pb-6 ${embedded ? "pt-1" : "pt-3"} max-w-3xl mx-auto`}>
        {!embedded && (
          <>
            <h1 className="text-lg font-bold mb-2 text-gray-600 text-center">
              Activity preferences
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              {isMobile
                ? "Choose which activities matter to you, and in what order they appear."
                : "Choose which activities matter to you, how they’re ordered, and how they’re measured by default."}
            </p>
          </>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Loading activity types...</div>
        ) : (
          <>
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    Enabled activities
                  </h2>
                  <p className="text-xs text-gray-400">
                    {isMobile
                      ? "Drag to reorder."
                      : "Drag to reorder. Select the default metric. Use the toggle to hide an activity."}
                  </p>
                </div>
                {reordering && (
                  <span className="text-xs text-gray-400">Saving order...</span>
                )}
              </div>
              {enabledActivities.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No enabled activities yet.
                </div>
              ) : (
                <ul className="space-y-3">
                  {enabledActivities.map((row) => {
                    const config =
                      ACTIVITY_TYPES[row.activity_type] ?? ACTIVITY_TYPES["other"];
                    const Icon = config.Icon;
                    const systemDefault = getSystemDefaultMetric(row.activity_type);
                    const override = prefs[row.activity_type];
                    const selected = override ?? systemDefault;
                    const metricLabel =
                      selected === "distance" ? "Distance" : "Duration";
                    const showMetric = supportsMetricOverride(row.activity_type);
                    const isSaving = savingMetric === row.activity_type;
                    const canDrag = !reordering && !savingToggle;
                    const canOpenMetric = showMetric;

                    return (
                      <li
                        key={row.activity_type}
                        data-activity-row={row.activity_type}
                        className={`flex flex-wrap items-center gap-3 rounded-xl border border-warm-200 bg-warm-50 px-3 py-3 transition ${
                          dragOverId === row.activity_type
                            ? "ring-2 ring-movenotes-primary/30"
                            : ""
                        }`}
                        onClick={() => {
                          if (!canOpenMetric || touchDragRef.current) return;
                          setActiveMetricType(row.activity_type);
                        }}
                        onDragOver={(event) => {
                          if (!canDrag) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverId(row.activity_type);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          void handleDrop(row.activity_type);
                        }}
                      >
                        <div className="flex min-w-[180px] flex-1 items-center gap-3">
                          <button
                            type="button"
                            className={`text-gray-400/40 transition touch-none ${
                              canDrag
                                ? "cursor-grab hover:text-gray-500/70 focus-visible:text-gray-500/70 active:cursor-grabbing"
                                : "cursor-not-allowed opacity-50"
                            }`}
                            draggable={canDrag}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            onTouchStart={(event) => {
                              if (!canDrag) return;
                              event.stopPropagation();
                              touchDragRef.current = true;
                              draggingIdRef.current = row.activity_type;
                              setDraggingId(row.activity_type);
                              dragStartOrderRef.current = enabledActivities.map(
                                (item) => item.activity_type
                              );
                              dragStartStateRef.current = activityTypes;
                            }}
                            onTouchMove={(event) => {
                              if (!canDrag) return;
                              if (!draggingIdRef.current) return;
                              if (event.cancelable) {
                                event.preventDefault();
                              }
                              const touch = event.touches[0];
                              const target = document.elementFromPoint(
                                touch.clientX,
                                touch.clientY
                              ) as HTMLElement | null;
                              const rowEl = target?.closest(
                                "[data-activity-row]"
                              ) as HTMLElement | null;
                              const targetId = rowEl?.dataset.activityRow;
                              if (!targetId || targetId === draggingIdRef.current)
                                return;

                              setDragOverId(targetId);
                              setActivityTypes((prev) => {
                                const enabled = prev
                                  .filter((item) => item.is_enabled)
                                  .sort((a, b) => a.sort_order - b.sort_order);
                                const fromIndex = enabled.findIndex(
                                  (item) =>
                                    item.activity_type === draggingIdRef.current
                                );
                                const toIndex = enabled.findIndex(
                                  (item) => item.activity_type === targetId
                                );
                                if (fromIndex === -1 || toIndex === -1) return prev;
                                const nextOrder = [...enabled];
                                const [moved] = nextOrder.splice(fromIndex, 1);
                                nextOrder.splice(toIndex, 0, moved);
                                const nextIds = nextOrder.map(
                                  (item) => item.activity_type
                                );
                                return applyEnabledOrder(prev, nextIds);
                              });
                            }}
                            onTouchEnd={() => {
                              if (!draggingIdRef.current) {
                                touchDragRef.current = false;
                                return;
                              }
                              const finalOrder = enabledOrderRef.current;
                              const startOrder = dragStartOrderRef.current || [];
                              if (!areIdsEqual(finalOrder, startOrder)) {
                                void commitEnabledOrder(
                                  finalOrder,
                                  dragStartStateRef.current
                                );
                              } else {
                                setDraggingId(null);
                                draggingIdRef.current = null;
                                setDragOverId(null);
                              }
                              setTimeout(() => {
                                touchDragRef.current = false;
                              }, 150);
                            }}
                            onTouchCancel={() => {
                              touchDragRef.current = false;
                              setDraggingId(null);
                              draggingIdRef.current = null;
                              setDragOverId(null);
                            }}
                            onDragStart={(event) => {
                              if (!canDrag) return;
                              setDraggingId(row.activity_type);
                              draggingIdRef.current = row.activity_type;
                              dragStartOrderRef.current = enabledActivities.map(
                                (item) => item.activity_type
                              );
                              dragStartStateRef.current = activityTypes;
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "text/plain",
                                row.activity_type
                              );
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              draggingIdRef.current = null;
                              setDragOverId(null);
                            }}
                            aria-label={`Reorder ${config.label}`}
                          >
                            <IconGripVertical size={16} strokeWidth={1.6} />
                          </button>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-3">
                              <Icon size={22} strokeWidth={1.8} />
                              <div>
                                <div className="text-sm font-semibold text-gray-800">
                                  {config.label}
                                  <span className="text-xs font-medium text-gray-400 ml-2">
                                    ·&nbsp;{metricLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={row.is_enabled}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleActivityType(row);
                        }}
                          disabled={savingToggle === row.activity_type}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ml-auto ${
                            row.is_enabled
                              ? "bg-movenotes-primary/70"
                              : "bg-gray-300/70"
                          } ${savingToggle === row.activity_type ? "opacity-60" : ""}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              row.is_enabled ? "translate-x-4" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                  Hidden activities
                </h2>
                <p className="text-xs text-gray-400">
                  These won’t appear in Quick Log, Stats, or Goals.
                </p>
              </div>
              {hiddenActivities.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No hidden activities.
                </div>
              ) : (
                <ul className="space-y-3">
                  {hiddenActivities.map((row) => {
                    const config =
                      ACTIVITY_TYPES[row.activity_type] ?? ACTIVITY_TYPES["other"];
                    const Icon = config.Icon;

                    return (
                      <li
                        key={row.activity_type}
                        className="flex items-center justify-between gap-3 rounded-xl border border-warm-200 bg-warm-50 px-3 py-3 opacity-60"
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={22} strokeWidth={1.8} />
                          <div className="text-sm font-semibold text-gray-800">
                            {config.label}
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={row.is_enabled}
                          onClick={() => toggleActivityType(row)}
                          disabled={savingToggle === row.activity_type}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            row.is_enabled ? "bg-movenotes-primary" : "bg-gray-300"
                          } ${savingToggle === row.activity_type ? "opacity-60" : ""}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                              row.is_enabled ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {showMetricModal && activeMetricConfig && (
        <ModalSheet onClose={() => setActiveMetricType(null)}>
          <div className="flex items-center gap-3 mb-4">
            <activeMetricConfig.Icon size={22} strokeWidth={1.8} />
            <div>
              <div className="text-base font-semibold text-gray-800">
                {activeMetricConfig.label}
              </div>
              <div className="text-xs text-gray-500">Metric preference</div>
            </div>
          </div>
          {activeMetricSelected ? (
            <div className="flex flex-wrap items-center gap-2">
              {(["distance", "duration"] as Metric[]).map((choice) => {
                const label = choice === "distance" ? "Distance" : "Duration";
                const isActive = activeMetricSelected === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => updateMetricPreference(activeMetricType!, choice)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      isActive
                        ? "bg-movenotes-primary text-primary-text border-movenotes-primary"
                        : "border-warm-200/70 text-gray-500/90 opacity-90"
                    } ${savingMetric === activeMetricType ? "opacity-60" : ""}`}
                    disabled={savingMetric === activeMetricType}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-600">Notes &amp; feeling</div>
          )}
        </ModalSheet>
      )}
    </>
  );
}
