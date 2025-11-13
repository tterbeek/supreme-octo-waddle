import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import QuickLogForm from "../components/QuickLogForm";
import Toast from "../components/Toast"; // ✅ add this
import { Bike, Footprints, Zap, Frown, Meh, Smile, Laugh } from "lucide-react";
import SwipeActions from "../components/SwipeActions";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import AddNoteModal from "../components/AddNoteModal";
import ActivityEditForm from "../components/ActivityEditForm";
import HeaderLogo from "../components/HeaderLogo";

export default function Home() {
  const [activities, setActivities] = useState<any[]>([]);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [activityType, setActivityType] = useState<"run" | "ride" | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const lastDeletedRef = useRef<any | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [goals, setGoals] = useState<any[]>([]);
  const [lastActivityId, setLastActivityId] = useState<string | null>(null);
  const [showNotePrompt, setShowNotePrompt] = useState(false);
  const [showNoteSkippedToast, setShowNoteSkippedToast] = useState(false);
  const [showNoteSavedToast, setShowNoteSavedToast] = useState(false);
  const [editActivity, setEditActivity] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

const refreshActivities = async () => {
  const { data } = await supabase
    .from("activities")
    .select("*")
    .order("date", { ascending: false });

  setActivities(data || []);

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: goalData } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("period", "week");
    setGoals(goalData || []);
  }
};


useEffect(() => {
  // Load once on mount
  refreshActivities();

  // 🔥 Realtime subscription for INSERT / UPDATE / DELETE
  const channel = supabase
    .channel("activities-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities" },
      (payload) => {
        console.log("[Realtime] Change received:", payload);

        if (payload.eventType === "INSERT") {
          setActivities((prev) => [payload.new, ...prev]);
        }

        if (payload.eventType === "UPDATE") {
          setActivities((prev) =>
            prev.map((a) => (a.id === payload.new.id ? payload.new : a))
          );
        }

        if (payload.eventType === "DELETE") {
          setActivities((prev) =>
            prev.filter((a) => a.id !== payload.old.id)
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


// ✅ Get only WEEKLY goals
const runGoal = goals.find(g => g.type === "run" && g.period === "week");
const rideGoal = goals.find(g => g.type === "ride" && g.period === "week");


// ✅ Monday-based week start at local midnight
const now = new Date();
const weekStart = new Date(now);
weekStart.setHours(0, 0, 0, 0);
weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));

const weekActivities = activities.filter(a => new Date(a.date) >= weekStart);

const runWeek = weekActivities.filter(a => a.type === "run");
const rideWeek = weekActivities.filter(a => a.type === "ride");

const runDist = runWeek.reduce((s, a) => s + a.distance_km, 0);
const rideDist = rideWeek.reduce((s, a) => s + a.distance_km, 0);

// Helper to build dots
const makeDots = (current: number, goal: number) => {
  const filled = Math.min(5, Math.round((current / goal) * 5));
  return "●".repeat(filled) + "○".repeat(5 - filled);
};



 return (
      <div className="min-h-screen bg-movenotes-bg p-4">
      <HeaderLogo />
  <div className="mt-2">
    <div className="absolute top-4 left-4 z-20">
  <button onClick={() => setMenuOpen(true)} className="p-2">
    <div className="w-6 h-0.5 bg-black mb-1"></div>
    <div className="w-6 h-0.5 bg-black mb-1"></div>
    <div className="w-6 h-0.5 bg-black"></div>
  </button>
</div>



{/* Weekly Progress Block — only if goals exist */}
{(runGoal || rideGoal) && (
  <div
    className="text-center mb-6 p-4 border rounded-lg bg-gray-50"
    onClick={() => navigate("/stats")}
  >
    <div className="font-semibold mb-1">This Week</div>

    <div className="text-left flex flex-wrap gap-6 justify-center text-sm text-gray-700">

      {runGoal && (
        <div className="flex items-center gap-2">
          <span className="font-medium">RUN:</span>
          <span>{Math.round(runDist)} / {runGoal.distance_km} km</span>
          <span className="text-movenotes-accent">
            {makeDots(runDist, runGoal.distance_km)}
          </span>
        </div>
      )}

      {rideGoal && (
        <div className="flex items-center gap-2">
          <span className="font-medium">RIDE:</span>
          <span>{Math.round(rideDist)} / {rideGoal.distance_km} km</span>
          <span className="text-movenotes-accent">
            {makeDots(rideDist, rideGoal.distance_km)}
          </span>
        </div>
      )}

    </div>
  </div>
)}


{/* Run / Ride Buttons */}
<h2 className="text-sm font-medium text-gray-500 mb-2">Log Activity</h2>

<div className="flex gap-4">
  <button
    onClick={() => { setActivityType("run"); setShowQuickLog(true); }}
    className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
  >
    <span className="text-xl">+</span>
    <Footprints className="w-5 h-5" />
    <span>Run</span>
  </button>

  <button
    onClick={() => { setActivityType("ride"); setShowQuickLog(true); }}
    className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
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
    <SwipeActions
    key={a.id}
    onDelete={() => deleteActivity(a)}
    onEdit={() => setEditActivity(a)} // 👈 open the edit modal
  >
<div
  className="
    rounded-xl p-5 bg-warm-100 border border-warm-200 shadow-sm text-center
  w-full mx-auto
  max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl
  sm:p-6 md:p-7

  "
>
  {/* 1️⃣ Icon + Title */}
  <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
    {a.type === "run" ? (
      <Footprints className="w-5 h-5 md:w-6 md:h-6 text-gray-900 opacity-90" />
    ) : (
      <Bike className="w-5 h-5 md:w-6 md:h-6 text-gray-900 opacity-90" />
    )}

    <span className="font-semibold text-gray-900 text-base md:text-lg leading-tight">
      {a.title || (a.type === "run" ? "Run" : "Ride")}
    </span>
  </div>

  {/* 2️⃣ Distance + Date */}
  <div className="text-sm md:text-base text-gray-700 flex items-center justify-center gap-2 mb-1">
    <span>{a.distance_km} km</span>
    <span className="text-gray-400">·</span>
    <span>
      {new Date(a.date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })}
    </span>
  </div>

  {/* 3️⃣ Feeling + Effort */}
  <div className="flex items-center justify-center gap-3 my-3">
    {/* Feeling */}
    {(() => {
      const f = Number(a.feeling) || 0;
      const base = "w-5 h-5 md:w-6 md:h-6";
      if (f <= 1) return <Frown className={`${base} text-movenotes-accent`} />;
      if (f === 2) return <Meh className={`${base} text-movenotes-accent`} />;
      if (f === 3) return <Smile className={`${base} text-movenotes-accent`} />;
      if (f >= 4) return <Laugh className={`${base} text-movenotes-accent`} />;
    })()}

    {/* Effort */}
    <div className="flex items-center gap-1 md:gap-1.5">
      {Array.from({ length: Number(a.effort) || 0 }).map((_, i) => (
        <Zap key={i} className="w-4 h-4 md:w-5 md:h-5 text-movenotes-accent" />
      ))}
    </div>
  </div>

  {/* 4️⃣ Notes */}
  {a.notes?.trim() && (
    <p
      className="
        mt-2 text-[15px] md:text-[17px] 
        text-gray-600 font-[DMSerifDisplay] italic leading-snug
        max-w-xs sm:max-w-sm md:max-w-md mx-auto
      "
    >
      “{a.notes}”
    </p>
  )}
</div>


  </SwipeActions>
))}
</div>

{showQuickLog && activityType && (
  <QuickLogForm
    type={activityType}
    onClose={() => {
      setShowQuickLog(false);
      setActivityType(null);
    }}
    onLogged={(activityId) => {
      setLastActivityId(activityId);
      setShowToast(true);        // ✅ instant feedback
    }}
  />

)}
{showNotePrompt && lastActivityId && (
  <AddNoteModal
    activityId={lastActivityId}
    onSave={() => {
      setShowNotePrompt(false);
      setShowNoteSavedToast(true);
    }}
    onSkip={() => {
      setShowNotePrompt(false);
      setShowNoteSkippedToast(true);
    }}
  />
)}

{editActivity && (
  <ActivityEditForm
    activity={editActivity}
    onClose={() => setEditActivity(null)}
    onUpdated={() => {
      setToastMessage("Activity updated ✅");
      setEditActivity(null);
      refreshActivities(); // call your fetch function if you have one
    }}
    onDeleted={() => {
      setToastMessage("Activity deleted 🗑️");
      setEditActivity(null);
      refreshActivities();
    }}
  />
)}

{toastMessage && (
  <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
)}


{showToast && (
  <Toast
    message="Activity logged ✅"
    onClose={() => {
      setShowToast(false);

      // ⏳ Wait until toast fully closes, then gently prompt for note
      if (lastActivityId) {
        setTimeout(() => setShowNotePrompt(true), 250);
      }
    }}
  />
)}
{showNoteSavedToast && (
  <Toast
    message="Note saved 💾"
    onClose={() => setShowNoteSavedToast(false)}
  />
)}

{showNoteSkippedToast && (
  <Toast
    message="Note skipped ✋"
    onClose={() => setShowNoteSkippedToast(false)}
  />
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


<Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

  </div>
  </div>
);

}
