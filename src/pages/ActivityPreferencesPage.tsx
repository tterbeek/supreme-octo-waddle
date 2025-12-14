import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import { getConfigurableActivities } from "../lib/getConfigurableActivities";
import { fetchActivityPreferences } from "../lib/fetchActivityPreferences";

type Metric = "distance" | "duration";
type PreferenceMap = Record<string, Metric>;

function buildPreferenceMap(
  prefs: { activity_type: string; default_metric: Metric }[]
): PreferenceMap {
  return Object.fromEntries(
    prefs.map((pref) => [pref.activity_type, pref.default_metric])
  );
}

function getSystemDefaultMetric(activityType: string): Metric {
  const config = ACTIVITY_TYPES[activityType];
  if (!config) return "distance";

  return config.defaultFields[0] === "distance_km" ? "distance" : "duration";
}

export default function ActivityPreferencesPage() {
  // Activity preferences affect default input behavior only.
  // They do not change historical data or stats.
  const [prefs, setPrefs] = useState<PreferenceMap>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const activities = useMemo(() => getConfigurableActivities(), []);

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
          setError("Please sign in to manage preferences.");
          setLoading(false);
        }
        return;
      }

      setUserId(user.id);

      try {
        const data = await fetchActivityPreferences(supabase, user.id);
        if (!cancelled) {
          setPrefs(buildPreferenceMap(data));
        }
      } catch (err: any) {
        console.error("[ActivityPreferences] Fetch error:", err?.message || err);
        if (!cancelled) {
          setError("Could not load preferences. Please try again.");
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

  const updatePreference = async (activityType: string, metric: Metric) => {
    if (!userId) return;

    const prev = prefs[activityType];
    setPrefs((p) => ({ ...p, [activityType]: metric }));
    setSaving(activityType);
    setError(null);

    try {
      await supabase
        .from("activity_preferences")
        .upsert(
          {
            user_id: userId,
            activity_type: activityType,
            default_metric: metric,
          },
          { onConflict: "user_id,activity_type" }
        );
    } catch (err: any) {
      console.error("[ActivityPreferences] Save error:", err?.message || err);
      setPrefs((p) => ({
        ...p,
        [activityType]: prev ?? getSystemDefaultMetric(activityType),
      }));
      setError("Could not save preference. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-3 text-gray-800">
        Activity preferences
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Choose which metric is emphasized by default for activities that support both.
        Other activities always use a single field.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading preferences…</div>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => {
            const current =
              prefs[activity.id] ?? getSystemDefaultMetric(activity.id);
            const Icon = activity.Icon;
            const systemDefault = getSystemDefaultMetric(activity.id);

            return (
              <li
                key={activity.id}
                className="flex items-center justify-between rounded-xl border border-warm-200 bg-warm-50 px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon size={22} strokeWidth={1.8} />
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      {activity.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      System default: {systemDefault === "distance" ? "Distance" : "Duration"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updatePreference(activity.id, "distance")}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      current === "distance"
                        ? "bg-movenotes-primary text-primary-text border-movenotes-primary"
                        : "border-warm-200 text-gray-700"
                    } ${saving === activity.id ? "opacity-60" : ""}`}
                    disabled={saving === activity.id}
                  >
                    Distance
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePreference(activity.id, "duration")}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      current === "duration"
                        ? "bg-movenotes-primary text-primary-text border-movenotes-primary"
                        : "border-warm-200 text-gray-700"
                    } ${saving === activity.id ? "opacity-60" : ""}`}
                    disabled={saving === activity.id}
                  >
                    Duration
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
