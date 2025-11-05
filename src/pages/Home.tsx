import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import QuickLogForm from "../components/QuickLogForm";
import { Bike, Footprints } from "lucide-react";


export default function Home() {
  const [activities, setActivities] = useState<any[]>([]);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [activityType, setActivityType] = useState<"run" | "ride" | null>(null);


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
  <div className="mt-10">
    <div className="mt-8 mb-6 p-4 border rounded-lg bg-gray-50">
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

    <div className="flex flex-col gap-4">
<button
  onClick={() => { setActivityType("run"); setShowQuickLog(true); }}
  className="bg-amber-300 border border-amber-400 text-black py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
>
  <span className="text-xl">+</span>
  <Footprints className="w-5 h-5" />
  <span>Run</span>
</button>

<button
  onClick={() => { setActivityType("ride"); setShowQuickLog(true); }}
  className="bg-amber-300 border border-amber-400 text-black py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
>
  <span className="text-xl">+</span>
  <Bike className="w-5 h-5" />
  <span>Ride</span>
</button>


      <Link
        to="/history"
        className="border border-gray-300 text-gray-700 text-center py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
      >
        View History
      </Link>
<Link to="/presets" className="text-center text-sm text-gray-500 underline">
  Manage Presets
</Link>



    </div>
{showQuickLog && activityType && (
  <QuickLogForm
    type={activityType}
    onClose={() => {
      setShowQuickLog(false);
      setActivityType(null);
    }}
  />
)}
  </div>
);

}
