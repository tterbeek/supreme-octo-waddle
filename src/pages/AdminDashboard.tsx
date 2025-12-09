import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

type WeekPoint = {
  week: string;
  new_users?: number;
  activities?: number;
};

type ActivityTypePoint = {
  type: string;
  total: number;
};

type PhotoUser = {
  email: string;
  photos: number;
};

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [newUsersThisWeek, setNewUsersThisWeek] = useState<number | null>(null);
  const [totalActivities, setTotalActivities] = useState<number | null>(null);
  const [activitiesThisWeek, setActivitiesThisWeek] = useState<number | null>(
    null
  );

  const [usersPerWeek, setUsersPerWeek] = useState<WeekPoint[]>([]);
  const [activitiesPerWeek, setActivitiesPerWeek] = useState<WeekPoint[]>([]);
  const [activitiesByType, setActivitiesByType] = useState<ActivityTypePoint[]>(
    []
  );

  const [topPhotoUsers, setTopPhotoUsers] = useState<PhotoUser[]>([]);
  const [heavyPhotoUsers, setHeavyPhotoUsers] = useState<PhotoUser[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [
        totalUsersRes,
        newUsersWeekRes,
        totalActRes,
        actWeekRes,
        usersPerWeekRes,
        actPerWeekRes,
        typesRes,
        topPhotosRes,
        heavyPhotosRes,
      ] = await Promise.all([
        supabase.rpc("admin_total_users"),
        supabase.rpc("admin_new_users_this_week"),
        supabase.rpc("admin_total_activities"),
        supabase.rpc("admin_activities_this_week"),
        supabase.rpc("admin_users_per_week"),
        supabase.rpc("admin_activities_per_week"),
        supabase.rpc("admin_activities_by_type"),
        supabase.rpc("admin_top_photo_users"),
        supabase.rpc("admin_users_over_50_photos"),
      ]);

      if (totalUsersRes.error) {
        console.error("[Admin] admin_total_users error", totalUsersRes.error);
        setError("Could not load admin analytics (users).");
      } else {
        setTotalUsers(totalUsersRes.data);
      }

      if (newUsersWeekRes.error) {
        console.error(
          "[Admin] admin_new_users_this_week error",
          newUsersWeekRes.error
        );
        setError("Could not load admin analytics (new users).");
      } else {
        setNewUsersThisWeek(newUsersWeekRes.data);
      }

      if (totalActRes.error) {
        console.error("[Admin] admin_total_activities error", totalActRes.error);
        setError("Could not load admin analytics (activities).");
      } else {
        setTotalActivities(totalActRes.data);
      }

      if (actWeekRes.error) {
        console.error(
          "[Admin] admin_activities_this_week error",
          actWeekRes.error
        );
        setError("Could not load admin analytics (this week activities).");
      } else {
        setActivitiesThisWeek(actWeekRes.data);
      }

      if (!usersPerWeekRes.error && Array.isArray(usersPerWeekRes.data)) {
        setUsersPerWeek(
          usersPerWeekRes.data.map((row: any) => ({
            ...row,
            week: formatWeekLabel(row.week),
          }))
        );
      } else if (usersPerWeekRes.error) {
        console.error(
          "[Admin] admin_users_per_week error",
          usersPerWeekRes.error
        );
        setError("Could not load users per week.");
      }

      if (!actPerWeekRes.error && Array.isArray(actPerWeekRes.data)) {
        setActivitiesPerWeek(
          actPerWeekRes.data.map((row: any) => ({
            ...row,
            week: formatWeekLabel(row.week),
          }))
        );
      } else if (actPerWeekRes.error) {
        console.error(
          "[Admin] admin_activities_per_week error",
          actPerWeekRes.error
        );
        setError("Could not load activities per week.");
      }

      if (!typesRes.error && Array.isArray(typesRes.data)) {
        setActivitiesByType(typesRes.data);
      } else if (typesRes.error) {
        console.error(
          "[Admin] admin_activities_by_type error",
          typesRes.error
        );
        setError("Could not load activities by type.");
      }

      if (!topPhotosRes.error && Array.isArray(topPhotosRes.data)) {
        setTopPhotoUsers(topPhotosRes.data);
      } else if (topPhotosRes.error) {
        console.error(
          "[Admin] admin_top_photo_users error",
          topPhotosRes.error
        );
        setError("Could not load top photo users.");
      }

      if (!heavyPhotosRes.error && Array.isArray(heavyPhotosRes.data)) {
        setHeavyPhotoUsers(heavyPhotosRes.data);
      } else if (heavyPhotosRes.error) {
        console.error(
          "[Admin] admin_users_over_50_photos error",
          heavyPhotosRes.error
        );
        setError("Could not load heavy photo users.");
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      {loading && <p className="text-gray-500">Loading analytics…</p>}
      {error && (
        <p className="text-sm text-red-600">
          {error} (check SQL function permissions/owner)
        </p>
      )}

      {/* KPI tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Users" value={totalUsers} />
        <StatCard label="New Users This Week" value={newUsersThisWeek} />
        <StatCard label="Total Activities" value={totalActivities} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Activities This Week" value={activitiesThisWeek} />
        <StatCard label="Users > 50 Photos" value={heavyPhotoUsers.length} />
      </div>

      {/* Users per week */}
      <ChartCard title="Users Per Week" hasData={usersPerWeek.length > 0}>
        <LineChartComponent data={usersPerWeek} dataKey="new_users" />
      </ChartCard>

      {/* Activities per week */}
      <ChartCard
        title="Activities Per Week"
        hasData={activitiesPerWeek.length > 0}
      >
        <LineChartComponent data={activitiesPerWeek} dataKey="activities" />
      </ChartCard>

      {/* Activities by type */}
      <ChartCard title="Activities By Type" hasData={activitiesByType.length > 0}>
        <BarChartComponent data={activitiesByType} />
      </ChartCard>

      {/* Top photo users */}
      <TableCard title="Top Photo Users" rows={topPhotoUsers} />

      {heavyPhotoUsers.length > 0 && (
        <TableCard title="Users With > 50 Photos" rows={heavyPhotoUsers} />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value ?? "–"}</p>
    </div>
  );
}

function ChartCard({
  title,
  hasData,
  children,
}: {
  title: string;
  hasData: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm w-full min-w-0">
      <h2 className="mb-4 text-sm font-medium text-gray-700">{title}</h2>
      <div
        className="h-64 w-full min-w-0"
        style={{ minHeight: 256, minWidth: 0 }}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No data yet
          </div>
        )}
      </div>
    </div>
  );
}

function LineChartComponent({
  data,
  dataKey,
}: {
  data: WeekPoint[];
  dataKey: string;
}) {
  return (
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="week" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Line type="monotone" dataKey={dataKey} stroke="#3b82f6" />
    </LineChart>
  );
}

function BarChartComponent({ data }: { data: ActivityTypePoint[] }) {
  return (
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="type" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="total" fill="#3b82f6" />
    </BarChart>
  );
}

function TableCard({ title, rows }: { title: string; rows: PhotoUser[] }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-gray-700">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-4">Email</th>
              <th className="py-2">Photos</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="py-2 text-gray-500">
                  No data available.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.email} className="border-b last:border-0">
                <td className="py-2 pr-4">{row.email}</td>
                <td className="py-2">{row.photos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatWeekLabel(value: any): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}
