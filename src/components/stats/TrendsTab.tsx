import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { AlertCircle } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { ACTIVITY_TYPES } from "../../config/activityTypes";
import { kmToMiles } from "../../lib/units";
import type { TrendMeta, TrendPoint } from "../../hooks/useActivityTrends";

type TrendsTabProps = {
  metasWithDefault: TrendMeta[];
  selectedMetric: Record<string, "distance" | "duration">;
  trendData: Record<string, TrendPoint[]>;
  getDefaultMetric: (meta: TrendMeta) => "distance" | "duration" | null;
  onToggleMetric: (activityType: string, metric: "distance" | "duration") => void;
  canToggle: (meta: TrendMeta) => boolean;
  hasTrendRows: boolean;
  trendsLoading: boolean;
  error: string | null;
  unitSystem: "imperial" | "metric" | string;
};

export default function TrendsTab({
  metasWithDefault,
  selectedMetric,
  trendData,
  getDefaultMetric,
  onToggleMetric,
  canToggle,
  hasTrendRows,
  trendsLoading,
  error,
  unitSystem,
}: TrendsTabProps) {
  return (
    <>
      {trendsLoading && !error && (
        <p className="text-sm text-gray-500 text-center">Loading trends…</p>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Unable to load stats</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {!error && (
        <div className="space-y-8 mt-3">
          <h2 className="text-lg font-bold text-movenotes-primary mb-1 text-center">
            Your movement over time
          </h2>

          {!hasTrendRows && !trendsLoading && (
            <p className="text-center text-movenotes-muted mt-8">
              Not enough activity yet to show trends 🌱
            </p>
          )}

          {metasWithDefault.map((meta) => {
            const defaultMetric = getDefaultMetric(meta);
            if (!defaultMetric) return null;
            const cfg = ACTIVITY_TYPES[meta.activity_type];
            const Icon = cfg.Icon;
            const activeMetric = selectedMetric[meta.activity_type] ?? defaultMetric;
            const key = `${meta.activity_type}:${activeMetric}`;
            const series = trendData[key] || [];
            if (!series.length) return null;
            const unitLabel =
              activeMetric === "distance"
                ? unitSystem === "imperial"
                  ? "mi"
                  : "km"
                : "min";

            const currentWeekStr = format(
              startOfWeek(new Date(), { weekStartsOn: 1 }),
              "yyyy-MM-dd"
            );

            const rows = series.map((point) => {
              const start = new Date(point.week_start + "T00:00:00");
              const end = new Date(start);
              end.setDate(end.getDate() + 6);
              const isCurrent = point.week_start === currentWeekStr;
              const value =
                activeMetric === "distance" && unitSystem === "imperial"
                  ? kmToMiles(point.value)
                  : point.value;
              return {
                week: point.week_start,
                weekLabel: format(end, "dd MMM"),
                value,
                isCurrent,
              };
            });

            const rowsWithLines = rows.map((row, idx) => {
              const isCurrent = row.isCurrent;
              const valueSolid = isCurrent ? null : row.value;
              const valueCurrent = isCurrent ? row.value : null;

              return {
                ...row,
                valueSolid,
                valueCurrent,
              };
            });

            const showToggle = canToggle(meta);

            return (
              <div
                key={meta.activity_type}
                className="rounded-xl border border-movenotes-border p-6 bg-movenotes-surface shadow-sm"
              >
                <div className="flex flex-col items-center gap-3 mb-3 text-center">
                  <div className="flex items-center gap-2">
                    <span className="text-movenotes-primary">
                      <Icon size={20} />
                    </span>
                    <h3 className="text-lg font-semibold text-movenotes-text">
                      {cfg.label} —{" "}
                      {activeMetric === "distance"
                        ? `Distance (${unitLabel})`
                        : "Duration (min)"}
                    </h3>
                  </div>

                  {showToggle && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleMetric(meta.activity_type, "distance")}
                        className={`px-3 py-1.5 text-xs rounded-full border transition ${
                          activeMetric === "distance"
                            ? "bg-movenotes-primary text-primary-text border-movenotes-primary"
                            : "border-warm-200 text-gray-700"
                        }`}
                      >
                        Distance
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleMetric(meta.activity_type, "duration")}
                        className={`px-3 py-1.5 text-xs rounded-full border transition ${
                          activeMetric === "duration"
                            ? "bg-movenotes-primary text-primary-text border-movenotes-primary"
                            : "border-warm-200 text-gray-700"
                        }`}
                      >
                        Duration
                      </button>
                    </div>
                  )}
                </div>

                {showToggle && (
                  <p className="text-xs text-movenotes-muted mb-3 text-center">
                    This graph shows only the entries where this metric was logged.
                  </p>
                )}

                {!showToggle && <div className="mb-3" />}

                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={rowsWithLines}>
                    <XAxis dataKey="weekLabel" stroke="#888" fontSize={12} />
                    <YAxis
                      stroke="#888"
                      fontSize={12}
                      label={{ value: unitLabel, angle: -90, position: "insideLeft" }}
                      tickFormatter={(v: number | string) =>
                        activeMetric === "distance"
                          ? Number(v).toFixed(0)
                          : Number(v).toFixed(0)
                      }
                    />
                    <RechartsTooltip
                      formatter={(value: number | string) =>
                        activeMetric === "distance"
                          ? `${Number(value).toFixed(0)} ${unitLabel}`
                          : `${Number(value).toFixed(0)} ${unitLabel}`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="valueSolid"
                      stroke="#5A7A69"
                      strokeWidth={3}
                      dot={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="valueCurrent"
                      stroke="transparent"
                      strokeWidth={0}
                      dot={{ r: 4, fill: "#5A7A69", stroke: "#5A7A69" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
