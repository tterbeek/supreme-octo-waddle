import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import {
  getCachedUserActivityTypes,
  normalizeUserActivityTypes,
  setCachedUserActivityTypes,
  type UserActivityTypeRow,
} from "../lib/userActivityTypesCache";

import { buildTrendSeries, type TrendPoint, type TrendPeriod } from '../lib/activityTrends';
export type { TrendPoint, TrendPeriod } from '../lib/activityTrends';

export type TrendMeta = {
  activity_type: keyof typeof ACTIVITY_TYPES;
  has_distance: boolean;
  has_duration: boolean;
  default_metric: "distance" | "duration" | null;
};

const fieldToMetric = (field: string | undefined): "distance" | "duration" | null => {
  if (field === "distance_km") return "distance";
  if (field === "duration_min") return "duration";
  return null;
};

const metaHasMetric = (meta: TrendMeta, metric: "distance" | "duration") =>
  metric === "distance" ? meta.has_distance : meta.has_duration;

export function useActivityTrends(userId: string | null, enabled: boolean, period: TrendPeriod = "week") {
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
        setUserActivityTypes(normalizeUserActivityTypes(cached));
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
      const rows = normalizeUserActivityTypes(
        (data || []) as UserActivityTypeRow[]
      );
      setUserActivityTypes(rows);
      setCachedUserActivityTypes(userId, rows);
    };

    loadActivityTypes();

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  useEffect(() => {
    let cancelled = false;
    setTrendMeta([]);
    setTrendData({});
    setError(null);
    if (!userId || !enabled) { setTrendsLoading(false); return; }
    setTrendsLoading(true);
    void Promise.resolve(supabase.rpc('stats_activity_trends', {
      p_period: period,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    })).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      if (fetchError) { setError(fetchError.message); setTrendsLoading(false); return; }
      const rows = data || [];
      const series = buildTrendSeries(rows);
      setTrendData(series);
      setTrendMeta([...new Set(rows.map(row => row.activity_type))].filter(type => !!ACTIVITY_TYPES[type]).map(type => ({
        activity_type: type,
        has_distance: !!series[`${type}:distance`]?.length,
        has_duration: !!series[`${type}:duration`]?.length,
        default_metric: null,
      })));
      setTrendsLoading(false);
    }).catch(() => { if (!cancelled) { setError('Could not load trends.'); setTrendsLoading(false); } });
    return () => { cancelled = true; };
  }, [userId, enabled, period]);

  useEffect(() => {
    setSelectedMetric({});
  }, [userId]);

  const onToggleMetric = useCallback((activityType: string, metric: "distance" | "duration") => {
    setSelectedMetric(previous => ({ ...previous, [activityType]: metric }));
  }, []);

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
          (selectedMetric[meta.activity_type] && metaHasMetric(meta, selectedMetric[meta.activity_type]) ? selectedMetric[meta.activity_type] : undefined) ??
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
