import { useEffect, useMemo, useState } from "react";
import ModalSheet from "./ModalSheet";
import {
  ACTIVITY_TYPES,
  SETTINGS_ACTIVITY_TYPE_IDS,
  isCreatableActivityType,
} from "../config/activityTypes";
import { supabase } from "../supabaseClient";
import {
  getCachedUserActivityTypes,
  normalizeUserActivityTypes,
  setCachedUserActivityTypes,
  type UserActivityTypeRow,
} from "../lib/userActivityTypesCache";

interface AddBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectActivity: (typeId: string) => void;
  onSelectJournalEntry: () => void;
}

export default function AddBottomSheet({
  open,
  onClose,
  onSelectActivity,
  onSelectJournalEntry,
}: AddBottomSheetProps) {
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
          setActivityTypes(normalizeUserActivityTypes(cached));
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
            console.warn("[AddBottomSheet] Seed error:", seedError.message);
          }
        } catch (seedError) {
          console.warn("[AddBottomSheet] Seed error:", seedError);
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
          console.warn("[AddBottomSheet] Load error:", error.message || error);
          if (!cached?.length && !hasLocalData) {
            setActivityTypes(fallbackActivityTypes());
          }
          return;
        }

        const rows = (data || []) as UserActivityTypeRow[];
        if (rows.length > 0) {
          const normalized = normalizeUserActivityTypes(rows);
          setActivityTypes(normalized);
          setCachedUserActivityTypes(user.id, normalized);
        } else if (!hasLocalData) {
          setActivityTypes(fallbackActivityTypes());
        }
      } catch (error) {
        console.warn("[AddBottomSheet] Load error:", error);
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
  }, [activityTypes.length, open]);

  const enabledActivities = useMemo(
    () =>
      activityTypes
        .filter(
          (row) => row.is_enabled && isCreatableActivityType(row.activity_type)
        )
        .map((row) => ACTIVITY_TYPES[row.activity_type])
        .filter(Boolean),
    [activityTypes]
  );

  const hiddenActivities = useMemo(
    () =>
      activityTypes
        .filter(
          (row) => !row.is_enabled && isCreatableActivityType(row.activity_type)
        )
        .map((row) => ACTIVITY_TYPES[row.activity_type])
        .filter(Boolean),
    [activityTypes]
  );

  if (!open) return null;

  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold text-center text-gray-800 mb-4">Add</h2>

      <button
        type="button"
        onClick={onSelectJournalEntry}
        className="w-full text-left rounded-xl border border-warm-200 bg-warm-100 px-4 py-4 shadow-sm text-gray-900 transition active:scale-[0.99]"
      >
        <div className="text-sm font-semibold">Journal entry</div>
        <div className="text-xs text-gray-600 mt-1">Write a free-form note</div>
      </button>

      <div className="my-5 border-t border-warm-200" />
      <div className="text-xs uppercase tracking-[0.16em] text-gray-500 mb-3 text-center">
        Choose activity
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 text-center">Loading…</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {enabledActivities.map((activityType) => {
            const Icon = activityType.Icon;
            return (
              <button
                key={activityType.id}
                type="button"
                onClick={() => onSelectActivity(activityType.id)}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95"
              >
                <Icon size={34} strokeWidth={1.6} />
                <span className="text-sm font-medium">{activityType.label}</span>
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
            hiddenActivities.map((activityType) => {
              const Icon = activityType.Icon;
              return (
                <button
                  key={activityType.id}
                  type="button"
                  onClick={() => onSelectActivity(activityType.id)}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95"
                >
                  <Icon size={32} strokeWidth={1.6} />
                  <span className="text-sm font-medium">{activityType.label}</span>
                </button>
              );
            })}
        </div>
      )}

      <button
        type="button"
        className="mt-6 w-full text-center text-sm text-gray-600 hover:text-gray-800"
        onClick={onClose}
      >
        Cancel
      </button>
    </ModalSheet>
  );
}
