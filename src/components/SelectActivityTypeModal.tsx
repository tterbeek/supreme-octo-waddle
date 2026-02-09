import { useEffect, useMemo, useState } from "react";
import ModalSheet from "./ModalSheet";
import { ACTIVITY_TYPES, SETTINGS_ACTIVITY_TYPE_IDS } from "../config/activityTypes";
import { supabase } from "../supabaseClient";
import {
  getCachedUserActivityTypes,
  setCachedUserActivityTypes,
  type UserActivityTypeRow,
} from "../lib/userActivityTypesCache";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (typeId: string) => void;
}

export function SelectActivityTypeModal({ open, onClose, onSelect }: Props) {
  const [activityTypes, setActivityTypes] = useState<UserActivityTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  const fallbackActivityTypes = () =>
    SETTINGS_ACTIVITY_TYPE_IDS.map((activity_type, index) => ({
      activity_type,
      sort_order: index + 1,
      is_enabled: true,
    }));

  const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Request timed out"));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setShowHidden(false);

    const load = async () => {
      const hasLocalData = activityTypes.length > 0;
      if (!hasLocalData) {
        setLoading(true);
      }

      try {
        const authResult = await withTimeout(supabase.auth.getUser(), 8000);
        const user = authResult?.data?.user;
        if (!user) {
          if (!hasLocalData) {
            setActivityTypes(fallbackActivityTypes());
          }
          return;
        }

        const cached = getCachedUserActivityTypes(user.id);
        if (cached?.length) {
          setActivityTypes(cached);
          if (!hasLocalData) {
            setLoading(false);
          }
        }

        try {
          const { error: seedError } = await withTimeout(
            supabase.rpc("ensure_user_activity_types_seeded"),
            8000
          );
          if (seedError) {
            console.warn("[SelectActivityTypeModal] Seed error:", seedError.message);
          }
        } catch (seedError) {
          console.warn("[SelectActivityTypeModal] Seed error:", seedError);
        }

        const { data, error } = await withTimeout(
          supabase
            .from("user_activity_types")
            .select("activity_type, sort_order, is_enabled")
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true }),
          8000
        );

        if (cancelled) return;
        if (error) {
          console.warn(
            "[SelectActivityTypeModal] Load error:",
            error.message || error
          );
          if (!cached?.length && !hasLocalData) {
            setActivityTypes(fallbackActivityTypes());
          }
          return;
        }

        const rows = (data || []) as UserActivityTypeRow[];
        if (rows.length > 0) {
          setActivityTypes(rows);
          setCachedUserActivityTypes(user.id, rows);
        } else if (!hasLocalData) {
          setActivityTypes(fallbackActivityTypes());
        }
      } catch (error) {
        console.warn("[SelectActivityTypeModal] Load error:", error);
        if (!hasLocalData) {
          setActivityTypes(fallbackActivityTypes());
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
  }, [open]);

  const enabledActivities = useMemo(
    () =>
      activityTypes
        .filter((row) => row.is_enabled)
        .map((row) => ACTIVITY_TYPES[row.activity_type])
        .filter(Boolean),
    [activityTypes]
  );
  const hiddenActivities = useMemo(
    () =>
      activityTypes
        .filter((row) => !row.is_enabled)
        .map((row) => ACTIVITY_TYPES[row.activity_type])
        .filter(Boolean),
    [activityTypes]
  );

  if (!open) return null;

  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold text-center text-gray-800 mb-4">
        Choose Activity
      </h2>

      {loading ? (
        <div className="text-sm text-gray-500 text-center">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {enabledActivities.map((t) => {
            const Icon = t.Icon;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95"
              >
                <Icon size={34} strokeWidth={1.6} />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            );
          })}

          {!showHidden && hiddenActivities.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden(true)}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-50 border border-warm-200 rounded-xl text-gray-600 transition hover:text-gray-800"
            >
              <span className="text-lg">⋯</span>
              <span className="text-sm font-medium">More</span>
            </button>
          )}

          {showHidden &&
            hiddenActivities.map((t) => {
              const Icon = t.Icon;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95"
                >
                  <Icon size={32} strokeWidth={1.6} />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              );
            })}
        </div>
      )}

      <button
        className="mt-6 w-full text-center text-sm text-gray-600 hover:text-gray-800"
        onClick={onClose}
      >
        Cancel
      </button>
    </ModalSheet>
  );
}
