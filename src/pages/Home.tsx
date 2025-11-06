import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import QuickLogForm from "../components/QuickLogForm";
import Toast from "../components/Toast"; // ✅ add this
import { Bike, Footprints } from "lucide-react";
import SwipeDelete from "../components/SwipeDelete";


export default function Home() {
  const [activities, setActivities] = useState<any[]>([]);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [activityType, setActivityType] = useState<"run" | "ride" | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const lastDeletedRef = useRef<any | null>(null);


useEffect(() => {
  // Initial load
  const load = async () => {
    const { data } = await supabase
      .from("activities")
      .select("*")
      .order("date", { ascending: false });

    setActivities(data || []);
  };

  load();

  // 🔥 Realtime subscription
  const channel = supabase
    .channel("activities-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities" },
      (payload) => {
        if (payload.eventType === "INSERT") {
          setActivities((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === "DELETE") {
          setActivities((prev) => prev.filter(a => a.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          setActivities((prev) =>
            prev.map((a) => (a.id === payload.new.id ? payload.new : a))
          );
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);


  const deleteActivity = async (activity: any) => {
  lastDeletedRef.current = activity;
  setActivities(prev => prev.filter(a => a.id !== activity.id));
  setShowUndoToast(true);
  await supabase.from("activities").delete().eq("id", activity.id);
};

const undoDelete = async () => {
  if (!lastDeletedRef.current) return;
  setActivities(prev => [lastDeletedRef.current, ...prev]);
  await supabase.from("activities").insert(lastDeletedRef.current);
  lastDeletedRef.current = null;
  setShowUndoToast(false);
};

const Stars = ({ value }: { value: number | string }) => {
  const rating = Number(value) || 0;
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <span
          key={n}
          className={n <= rating ? "text-amber-400" : "text-gray-300"}
        >
          ★
        </span>
      ))}
    </div>
  );
};

  const currentYear = new Date().getFullYear();

  const yearActivities = activities.filter(a =>
    new Date(a.date).getFullYear() === currentYear
  );

  const runActivities = yearActivities.filter(a => a.type === "run");
  const rideActivities = yearActivities.filter(a => a.type === "ride");

  const totalRunDistance = runActivities.reduce((sum, a) => sum + a.distance_km, 0);
  const totalRideDistance = rideActivities.reduce((sum, a) => sum + a.distance_km, 0);


 return (
<div className="mt-2">


{/* Year Summary */}
<h2 className="text-sm font-medium text-gray-500 mb-1">This Year's Stats</h2>

<div className="mt-2 mb-4 p-4 border rounded-lg bg-gray-50">
  <div className="flex justify-between">
    <div className="text-left">
      <div className="font-semibold">Running</div>
        <div className="text-sm text-gray-600">
          {Math.round(totalRunDistance)} km • {runActivities.length} activities
        </div>
    </div>
    <div className="text-right">
      <div className="font-semibold">Cycling</div>
      <div className="text-sm text-gray-600">
        {Math.round(totalRideDistance)} km • {rideActivities.length} activities
      </div>
    </div>
  </div>
</div>


{/* Run / Ride Buttons */}
<h2 className="text-sm font-medium text-gray-500 mb-2">Log Activity</h2>

<div className="flex gap-4">
  <button
    onClick={() => { setActivityType("run"); setShowQuickLog(true); }}
    className="flex-1 bg-amber-300 border border-amber-400 text-black py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
  >
    <span className="text-xl">+</span>
    <Footprints className="w-5 h-5" />
    <span>Run</span>
  </button>

  <button
    onClick={() => { setActivityType("ride"); setShowQuickLog(true); }}
    className="flex-1 bg-amber-300 border border-amber-400 text-black py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
  >
    <span className="text-xl">+</span>
    <Bike className="w-5 h-5" />
    <span>Ride</span>
  </button>
</div>  {/* ✅ CLOSE BUTTON ROW HERE */}

{/* Recent History */}
<h2 className="text-sm font-medium text-gray-500 mt-6 mb-2">Recent Activity</h2>

<div className="flex flex-col gap-3">
  {activities.map((a) => (
    <SwipeDelete key={a.id} onDelete={() => deleteActivity(a)}>
<div className="border rounded-xl p-4 bg-white shadow-sm text-center">
  {/* Line 1 */}
<div className="text-base font-medium text-gray-900 flex flex-wrap gap-1 justify-center text-center">

    {/* Title (or fallback to run/ride) */}
    <span>{a.title || (a.type === "run" ? "Run" : "Ride")}</span>

    <span>–</span>
    <span>{a.distance_km} km</span>

    <span>–</span>
  <span className="text-gray-500">{a.type === "run" ? "Run" : "Ride"}</span>

    <span>–</span>
    <span>
      {new Date(a.date).toLocaleDateString("en-GB", {
        weekday: "short", // Thurs
        day: "numeric",   // 5
        month: "short"    // Nov
      })}
    </span>

  </div>

  {/* Line 2: Stars */}
 <div className="mt-1 flex justify-center">
    <Stars value={a.feeling} />
  </div>
</div>

    </SwipeDelete>
  ))}
</div>

<Link to="/presets" className="text-center text-sm text-gray-500 underline mt-4">
  Manage Presets
</Link>

{showQuickLog && activityType && (
  <QuickLogForm
    type={activityType}
    onClose={() => {
      setShowQuickLog(false);
      setActivityType(null);
    }}
    onLogged={() => setShowToast(true)} // ✅ triggers toast in Home
  />
)}
{showToast && (
  <Toast message="Activity logged ✅" onClose={() => setShowToast(false)} />
)}
{showUndoToast && (
  <Toast
    message={
      <>
        Activity deleted —
        <button onClick={undoDelete} className="underline ml-1">
          Undo
        </button>
      </>
    }
    onClose={() => {
      setShowUndoToast(false);
      lastDeletedRef.current = null;
    }}
  />
)}

  </div>
);

}
