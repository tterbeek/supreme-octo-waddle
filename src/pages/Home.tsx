// src/pages/Home.tsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import QuickLogForm from "../components/QuickLogForm";
import Toast from "../components/Toast";
import { Bike, Footprints, Zap, Frown, Meh, Smile, Laugh } from "lucide-react";
import SwipeActions from "../components/SwipeActions";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import AddNoteModal from "../components/AddNoteModal";
import ActivityEditForm from "../components/ActivityEditForm";
import GoalProgressCard from "../components/GoalProgressCard";
import type { Goal } from "../types";

export default function Home() {
  const navigate = useNavigate();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------
  const [userId, setUserId] = useState<string | null>(null);

  // Feed activities (recent history list)
  const [activities, setActivities] = useState<any[]>([]);

  // Activities used for goals (last 60 days)
  const [activitiesForGoals, setActivitiesForGoals] = useState<any[]>([]);

  // Goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]); // IDs

  // Quick log
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [activityType, setActivityType] = useState<"run" | "ride" | null>(null);

  // Toasts
  const [showToast, setShowToast] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showNoteSkippedToast, setShowNoteSkippedToast] = useState(false);
  const [showNoteSavedToast, setShowNoteSavedToast] = useState(false);

  // Notes
  const [lastActivityId, setLastActivityId] = useState<string | null>(null);
  const [showNotePrompt, setShowNotePrompt] = useState(false);

  // Edit activity
  const [editActivity, setEditActivity] = useState<any | null>(null);

  // Sidebar
  const [menuOpen, setMenuOpen] = useState(false);

  // Delete / undo
  const lastDeletedRef = useRef<any | null>(null);

  // Infinite scroll feed
  const [feedOffset, setFeedOffset] = useState(0);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const FEED_PAGE_SIZE = 20;

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  async function refreshActivities() {
    if (!userId) return;

    // 1) For goals: last 60 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const { data: goalActs } = await supabase
      .from("activities")
      .select("id, user_id, type, date, distance_km, feeling, effort")
      .eq("user_id", userId)
      .gte("date", cutoffStr)
      .order("date", { ascending: false });

    setActivitiesForGoals(goalActs || []);

    // 2) For feed: first page (20)
    const { data: firstFeed } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(FEED_PAGE_SIZE);

    setActivities(firstFeed || []);
    setFeedOffset(firstFeed ? firstFeed.length : 0);
    setHasMoreFeed(!!firstFeed && firstFeed.length === FEED_PAGE_SIZE);
  }

  const loadMoreFeed = async () => {
  if (!hasMoreFeed) return;
  if (!userId) return;

  // 🔥 read current offset *once* outside state setters
  const offset = feedOffset;

  const { data: more } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .range(offset, offset + FEED_PAGE_SIZE - 1);

  if (!more || more.length === 0) {
    setHasMoreFeed(false);
    return;
  }

  // Append results
  setActivities((prev) => [...prev, ...more]);

  // Advance offset safely
  setFeedOffset((prev) => prev + more.length);

  // Stop if fewer than full page
  if (more.length < FEED_PAGE_SIZE) {
    setHasMoreFeed(false);
  }
};

  // --------------------------------------------------
  // INITIAL LOAD: user → goals → activitiesForGoals + feed
  // --------------------------------------------------
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // 1) Goals
      const { data: g } = await supabase
        .from("goals")
        .select("id, activity_type, metric, period, target, name, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      setGoals((g as Goal[]) || []);

      // 2) Goal preferences
      const { data: prefs } = await supabase
        .from("goal_preferences")
        .select("goal_id")
        .eq("user_id", user.id);

      setSelectedGoals(prefs?.map((p) => p.goal_id) || []);

      // 3) Activities for goals (last 60 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const { data: goalActs } = await supabase
        .from("activities")
        .select("id, user_id, type, date, distance_km, feeling, effort")
        .eq("user_id", user.id)
        .gte("date", cutoffStr)
        .order("date", { ascending: false });

      setActivitiesForGoals(goalActs || []);

      // 4) First feed page
      const { data: firstFeed } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(FEED_PAGE_SIZE);

      setActivities(firstFeed || []);
      setFeedOffset(firstFeed ? firstFeed.length : 0);
      setHasMoreFeed(!!firstFeed && firstFeed.length === FEED_PAGE_SIZE);
    };

    load();
  }, []);

  // --------------------------------------------------
  // INFINITE SCROLL VIA WINDOW SCROLL
  // --------------------------------------------------
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        loadMoreFeed();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMoreFeed]);

  // --------------------------------------------------
  // GOALS FOR HOMEPAGE (max 2 shown, chosen by user)
  // --------------------------------------------------
  const homeGoals = goals
    .filter((g) => selectedGoals.includes(g.id))
    .slice(0, 3); // still respect up to 3, we’ll *display* max 2

  // --------------------------------------------------
  // DELETE / UNDO
  // --------------------------------------------------

  const undoDelete = async () => {
    if (!lastDeletedRef.current) return;
    setActivities((prev) => [lastDeletedRef.current, ...prev]);
    await supabase.from("activities").insert(lastDeletedRef.current);
    lastDeletedRef.current = null;
    setShowUndoToast(false);
    refreshActivities();
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-movenotes-bg p-1">
      
      <div className="mt-2">


        {/* -------------------------------------------------- */}
        {/* HOME GOALS SECTION (above QuickLog buttons)       */}
        {/* -------------------------------------------------- */}
        {homeGoals.length > 0 && (
          <div
            className="bg-warm-100 border border-warm-200 rounded-xl p-4 shadow-sm mt-4 mb-6"
            onClick={() => navigate("/stats")}
          >
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Your Goals
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {homeGoals.slice(0, 2).map((g) => (
                <GoalProgressCard
                  key={g.id}
                  goal={g}
                  activities={activitiesForGoals}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* LOG ACTIVITY BUTTONS                               */}
        {/* -------------------------------------------------- */}
        <h2 className="text-sm font-medium text-gray-500 mb-2">
          Log Activity
        </h2>

        <div className="flex gap-4">
          <button
            onClick={() => {
              setActivityType("run");
              setShowQuickLog(true);
            }}
            className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
          >
            <span className="text-xl">+</span>
            <Footprints className="w-5 h-5" />
            <span>Run</span>
          </button>

          <button
            onClick={() => {
              setActivityType("ride");
              setShowQuickLog(true);
            }}
            className="flex-1 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full text-lg font-medium flex items-center justify-center gap-1.5 transition transform hover:-translate-y-0.5 active:scale-95"
          >
            <span className="text-xl">+</span>
            <Bike className="w-5 h-5" />
            <span>Ride</span>
          </button>
        </div>

        {/* -------------------------------------------------- */}
        {/* RECENT HISTORY                                     */}
        {/* -------------------------------------------------- */}
        <h2 className="text-sm font-medium text-gray-500 mt-6 mb-2">
          Recent Activity
        </h2>

        <div className="flex flex-col gap-3">
          {activities.map((a) => (
            <SwipeActions
              key={a.id}
              onEdit={() => setEditActivity(a)}
            >
              <div
                className="
                  rounded-xl p-5 bg-warm-100 border border-warm-200 shadow-sm text-center
                  w-full mx-auto
                  max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl
                  sm:p-6 md:p-7
                "
              >
                {/* Icon + Title */}
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

                {/* Distance + Date */}
                <div className="text-sm md:text-base text-gray-700 flex items-center justify-center gap-2 mb-1">
                  <span>{a.distance_km} km</span>
                  <span className="text-gray-400">·</span>
                  <span>
                    {new Date(a.date).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "2-digit"
                    }).replace(/(\d{2})$/, "’$1")}
                  </span>
                </div>

                {/* Feeling + Effort */}
                <div className="flex items-center justify-center gap-3 my-3">
                  {/* Feeling */}
                  {(() => {
                    const f = Number(a.feeling) || 0;
                    const base = "w-5 h-5 md:w-6 md:h-6";
                    if (f <= 1)
                      return (
                        <Frown className={`${base} text-movenotes-accent`} />
                      );
                    if (f === 2)
                      return <Meh className={`${base} text-movenotes-accent`} />;
                    if (f === 3)
                      return (
                        <Smile className={`${base} text-movenotes-accent`} />
                      );
                    if (f >= 4)
                      return (
                        <Laugh className={`${base} text-movenotes-accent`} />
                      );
                    return null;
                  })()}

                  {/* Effort */}
                  <div className="flex items-center gap-1 md:gap-1.5">
                    {Array.from({ length: Number(a.effort) || 0 }).map(
                      (_, i) => (
                        <Zap
                          key={i}
                          className="w-4 h-4 md:w-5 md:h-5 text-movenotes-accent"
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Notes */}
                {a.notes?.trim() && (
                  <p
                    className="
                      mt-2 text-[15px] md:text[17px]
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

        {/* -------------------------------------------------- */}
        {/* MODALS & TOASTS                                    */}
        {/* -------------------------------------------------- */}
        {showQuickLog && activityType && (
          <QuickLogForm
            type={activityType}
            onClose={() => {
              setShowQuickLog(false);
              setActivityType(null);
            }}
            onLogged={async (activityId) => {
              setLastActivityId(activityId);
              setShowToast(true);
              await refreshActivities();
            }}
          />
        )}

        {showNotePrompt && lastActivityId && (
          <AddNoteModal
            activityId={lastActivityId}
            onSave={() => {
              setShowNotePrompt(false);
              setShowNoteSavedToast(true);
              refreshActivities();
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
              refreshActivities();
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
