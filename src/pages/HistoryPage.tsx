import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import SwipeDelete from "../components/SwipeDelete";
import Toast from "../components/Toast";



export default function HistoryPage() {
    const [activities, setActivities] = useState<any[]>([]);
    const navigate = useNavigate();
    const lastDeletedRef = useRef<any | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);

    const deleteActivity = (activity: any) => {
    lastDeletedRef.current = activity; // store it

    // remove instantly
    setActivities(prev => prev.filter(a => a.id !== activity.id));
    setShowUndoToast(true);

    // finalize deletion after 2 seconds (if no undo)
    setTimeout(async () => {
        if (lastDeletedRef.current && lastDeletedRef.current.id === activity.id) {
        await supabase.from("activities").delete().eq("id", activity.id);
        lastDeletedRef.current = null;
        }
    }, 2000);
    };

    const undoDelete = () => {
    if (!lastDeletedRef.current) return;

    setActivities(prev => [lastDeletedRef.current, ...prev]);

    lastDeletedRef.current = null;
    setShowUndoToast(false);
    };


useEffect(() => {
  const load = async () => {
    const { data } = await supabase
      .from("activities")
      .select("*")
      .order("date", { ascending: false });

    setActivities(data || []);
  };

  load();
}, []);

const currentYear = new Date().getFullYear();

const yearActivities = activities.filter(a =>
  new Date(a.date).getFullYear() === currentYear
);

const runActivities = yearActivities.filter(a => a.type === "run");
const rideActivities = yearActivities.filter(a => a.type === "ride");

const totalRunDistance = runActivities.reduce((sum, a) => sum + a.distance_km, 0);
const totalRideDistance = rideActivities.reduce((sum, a) => sum + a.distance_km, 0);


  return (
    <div>
<div className="flex items-center justify-between mb-4">
<button
  onClick={() => navigate("/")}
  className="border border-gray-300 text-gray-700 px-3 py-2 rounded-full text-sm font-medium transition transform hover:-translate-y-0.5"
>
  ← Home
</button>
  <h1 className="text-xl font-bold">History ({currentYear})</h1>
  <div className="w-10" /> {/* Spacer for centering title */}
</div>

<div className="mb-6 p-4 border rounded-lg bg-gray-50">
  <div className="flex justify-between">

    <div className="text-left">
      <div className="font-semibold">Running</div>
      <div className="text-sm text-gray-600">
        {totalRunDistance.toFixed(1)} km • {runActivities.length} activities
      </div>
    </div>

    <div className="text-right">
      <div className="font-semibold">Cycling</div>
      <div className="text-sm text-gray-600">
        {totalRideDistance.toFixed(1)} km • {rideActivities.length} activities
      </div>
    </div>

  </div>
</div>

      <div className="flex flex-col gap-3">
        {activities.map((a) => (
        <SwipeDelete key={a.id} onDelete={() => deleteActivity(a)}>
        <div className="border rounded-xl p-4">
            <div className="font-medium">{a.type === "run" ? "Run" : "Ride"}</div>
            <div className="text-sm text-gray-600">
            {a.distance_km} km · {new Date(a.date).toLocaleDateString()}
            </div>
        </div>
        </SwipeDelete>

        ))}
      </div>

      <Link
        to="/"
        className="block mt-6 text-blue-600 text-center underline"
      >
        Back
      </Link>
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
