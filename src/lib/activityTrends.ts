export type TrendPeriod = 'week' | 'month' | 'year';
export type TrendPoint = { period_start: string; value: number };
export type TrendAggregate = {
  activity_type: string; period_start: string;
  distance_value: number | null; duration_value: number | null;
};

/** Keep missing measurements absent and genuine zero measurements visible. */
export function buildTrendSeries(rows: TrendAggregate[]) {
  const series: Record<string, TrendPoint[]> = {};
  for (const row of rows) {
    for (const metric of ['distance', 'duration'] as const) {
      const value = row[`${metric}_value`];
      if (value === null) continue;
      (series[`${row.activity_type}:${metric}`] ??= []).push({ period_start: row.period_start, value: Number(value) });
    }
  }
  for (const points of Object.values(series)) points.sort((a, b) => a.period_start.localeCompare(b.period_start));
  return series;
}
