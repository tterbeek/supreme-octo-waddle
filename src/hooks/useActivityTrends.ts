import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import {
  getCachedUserActivityTypes,
  setCachedUserActivityTypes,
  type UserActivityTypeRow,
} from "../lib/userActivityTypesCache";

const TRENDS_META_RPC = "stats_activity_trend_meta";
const TRENDS_SERIES_RPC = "stats_activity_trend_series";

export type TrendMeta = {
  activity_type: keyof typeof ACTIVITY_TYPES;
  has_distance: boolean;
  has_duration: boolean;
  default_metric: "distance" | "duration" | null;
};

export type TrendPoint = {
  week_start: string;
  value: number;
};

const isSchemaCacheError = (err: any) =>
  typeof err?.message === "string" && err.message.toLowerCase().includes("schema cache");

async function fetchTrendMeta(userId: string) {
  const { data, error } = await supabase.rpc(TRENDS_META_RPC, {
    target_user: userId,
    weeks_back: 9,
  });
  if (!error) return data as TrendMeta[];

  if (isSchemaCacheError(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase.rpc(
      TRENDS_META_RPC,
      {
        p_target_user: userId,
        p_weeks_back: 9,
      }
    );
    if (!fallbackError) return fallbackData as TrendMeta[];
  }

  throw error;
}

async function fetchTrendSeries(
  userId: string,
  activityType: string,
  metric: "distance" | "duration"
) {
  const { data, error } = await supabase.rpc(TRENDS_SERIES_RPC, {
    target_user: userId,
    activity_type: activityType,
    metric,
    weeks_back: 9,
  });
  if (!error) return data as TrendPoint[];

  if (isSchemaCacheError(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase.rpc(
      TRENDS_SERIES_RPC,
      {
        p_target_user: userId,
        p_activity_type: activityType,
        p_metric: metric,
        p_weeks_back: 9,
      }
    );
    if (!fallbackError) return fallbackData as TrendPoint[];
  }

  throw error;
}

const fieldToMetric = (field: string | undefined): "distance" | "duration" | null => {
  if (field === "distance_km") return "distance";
  if (field === "duration_min") return "duration";
  return null;
};

const metaHasMetric = (meta: TrendMeta, metric: "distance" | "duration") =>
  metric === "distance" ? meta.has_distance : meta.has_duration;

export function useActivityTrends(userId: string | null, enabled: boolean) {
  const [trendMeta, setTrendMeta] = useState<TrendMeta[]>([]);
  const [trendData, setTrendData] = useState<Record<string, TrendPoint[]>>({});
  const [selectedMetric, setSelectedMetric] = useState<
    Record<string, "distance" | "duration">
  >({});
  const [activityPreferences, setActivityPreferences] = useState<
    Record<string, "distance" | "duration">
  >({});
  const [userActivityTypes, setUserActivityTypes] = useState<UserActivityTypeRow[]>(
    []
  );
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canToggle = useCallback(
    (meta: TrendMeta) => meta.has_distance && meta.has_duration,
    []
  );

  const getDefaultMetric = useCallback(
    (meta: TrendMeta): "distance" | "duration" | null => {
      const pref = activityPreferences[meta.activity_type];
      if (pref && metaHasMetric(meta, pref)) return pref;
      const config = ACTIVITY_TYPES[meta.activity_type];
      const configDefault = fieldToMetric(config?.defaultFields?.[0]);
      if (configDefault && metaHasMetric(meta, configDefault)) return configDefault;
      if (meta.default_metric && metaHasMetric(meta, meta.default_metric)) {
        return meta.default_metric;
      }
      if (meta.has_duration) return "duration";
      if (meta.has_distance) return "distance";
      return null;
    },
    [activityPreferences]
  );

  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;
    const loadPrefs = async () => {
      const { data, error: prefsError } = await supabase
        .from("activity_preferences")
        .select("activity_type, default_metric")
        .eq("user_id", userId);
      if (prefsError) {
        console.error("[Trends] Could not load activity preferences", prefsError.message);
        return;
      }
      if (cancelled) return;
      const map: Record<string, "distance" | "duration"> = {};
      (data || []).forEach((row) => {
        if (row.default_metric === "distance" || row.default_metric === "duration") {
          map[row.activity_type] = row.default_metric;
        }
      });
      setActivityPreferences(map);
    };
    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;

    const loadActivityTypes = async () => {
      const cached = getCachedUserActivityTypes(userId);
      if (cached?.length) {
        setUserActivityTypes(cached);
      }

      const { error: seedError } = await supabase.rpc(
        "ensure_user_activity_types_seeded"
      );
      if (seedError) {
        console.warn("[Trends] Could not seed activity types:", seedError.message);
      }

      const { data, error: typesError } = await supabase
        .from("user_activity_types")
        .select("activity_type, sort_order, is_enabled")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true });

      if (typesError) {
        console.warn("[Trends] Could not load activity types:", typesError.message);
        return;
      }
      if (cancelled) return;
      const rows = (data || []) as UserActivityTypeRow[];
      setUserActivityTypes(rows);
      setCachedUserActivityTypes(userId, rows);
    };

    loadActivityTypes();

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;
    setTrendsLoading(true);
    fetchTrendMeta(userId)
      .then((data) => {
        if (cancelled) return;
        setTrendMeta(data || []);
        setError(null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error("[Trends] Meta fetch error:", err?.message || err);
        setError(err?.message || "Could not load trends.");
      })
      .finally(() => {
        if (!cancelled) setTrendsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  useEffect(() => {
    if (!enabled || !trendMeta.length || !userId) return;

    setSelectedMetric((prev) => {
      const next = { ...prev };
      trendMeta.forEach((meta) => {
        const def = getDefaultMetric(meta);
        if (!def) return;
        const current = prev[meta.activity_type];
        if (!current || !metaHasMetric(meta, current)) {
          next[meta.activity_type] = def;
        }
      });
      return next;
    });

    const missing = trendMeta.filter((meta) => {
      const def = getDefaultMetric(meta);
      return def && !trendData[`${meta.activity_type}:${def}`];
    });

    if (!missing.length) return;

    let cancelled = false;
    setTrendsLoading(true);

    const loadSeries = async () => {
      try {
        await Promise.all(
          missing.map(async (meta) => {
            const def = getDefaultMetric(meta);
            if (!def) return;
            const series = await fetchTrendSeries(userId, meta.activity_type, def);
            if (cancelled) return;
            setTrendData((prev) => ({
              ...prev,
              [`${meta.activity_type}:${def}`]: series,
            }));
          })
        );
      } catch (err: any) {
        if (!cancelled) {
          console.error("[Trends] Series fetch error:", err?.message || err);
          setError(err?.message || "Could not load trend data.");
        }
      } finally {
        if (!cancelled) {
          setTrendsLoading(false);
        }
      }
    };

    loadSeries();

    return () => {
      cancelled = true;
    };
    // trendData is intentionally included to avoid refetching loaded series
  }, [trendMeta, trendData, userId, activityPreferences, enabled, getDefaultMetric]);

  const onToggleMetric = useCallback(
    async (activityType: string, metric: "distance" | "duration") => {
      if (!userId) return;

      setSelectedMetric((prev) => ({ ...prev, [activityType]: metric }));

      const key = `${activityType}:${metric}`;
      if (trendData[key]) return;

      try {
        setTrendsLoading(true);
        const series = await fetchTrendSeries(userId, activityType, metric);
        setTrendData((prev) => ({ ...prev, [key]: series }));
      } catch (err: any) {
        console.error("[Trends] Series fetch error:", err?.message || err);
        setError(err?.message || "Could not load trend data.");
      } finally {
        setTrendsLoading(false);
      }
    },
    [userId, trendData]
  );

  const metasWithDefault = useMemo(
    () => trendMeta.filter((meta) => getDefaultMetric(meta)),
    [trendMeta, getDefaultMetric]
  );

  const orderedMetas = useMemo(() => {
    if (!userActivityTypes.length) return metasWithDefault;

    const enabled = userActivityTypes.filter((row) => row.is_enabled);
    if (!enabled.length) return [];

    const orderMap = new Map(
      enabled.map((row) => [row.activity_type, row.sort_order])
    );
    const enabledSet = new Set(enabled.map((row) => row.activity_type));

    return metasWithDefault
      .filter((meta) => enabledSet.has(meta.activity_type))
      .sort((a, b) => {
        const orderA = orderMap.get(a.activity_type) ?? 9999;
        const orderB = orderMap.get(b.activity_type) ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.activity_type.localeCompare(b.activity_type);
      });
  }, [metasWithDefault, userActivityTypes]);

  const hasTrendRows = useMemo(
    () =>
      orderedMetas.some((meta) => {
        const activeMetric =
          selectedMetric[meta.activity_type] ??
          (getDefaultMetric(meta) as "distance" | "duration");
        const key = `${meta.activity_type}:${activeMetric}`;
        return (trendData[key]?.length || 0) > 0;
      }),
    [orderedMetas, selectedMetric, trendData, getDefaultMetric]
  );

  return {
    trendMeta,
    trendData,
    selectedMetric,
    trendsLoading,
    error,
    onToggleMetric,
    metasWithDefault: orderedMetas,
    hasTrendRows,
    getDefaultMetric,
    canToggle,
  };
}
