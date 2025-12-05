// src/pages/GoalsPage.tsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import SwipeActions from "../components/SwipeActions";
import AddGoalModal from "../components/AddGoalModal";
import EditGoalModal from "../components/EditGoalModal";
import type { Goal } from "../types";
import { Target, Star } from "lucide-react";
import { ACTIVITY_TYPES } from "../config/activityTypes";

export default function GoalsPage() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

const [starredGoalIds, setStarredGoalIds] = useState<string[]>([]);

useEffect(() => {
  const loadPrefs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("goal_preferences")
      .select("goal_id")
      .eq("user_id", user.id);

    setStarredGoalIds((data || []).map((r) => r.goal_id));
  };

  loadPrefs();
}, []);



  const loadGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/");

    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    setGoals(data || []);
    setLoading(false);
  };

// Group + sort
const periodOrder: Record<"week" | "month" | "year", number> = {
  week: 1,
  month: 2,
  year: 3,
};

const typeOrder: Record<string, number> = Object.keys(ACTIVITY_TYPES).reduce(
  (acc, id, idx) => {
    acc[id] = idx + 1;
    return acc;
  },
  {} as Record<string, number>
);
typeOrder["any"] = Number.MAX_SAFE_INTEGER; // legacy "any" goes last

const sortedGoals = [...goals].sort((a, b) => {
  const pDiff = periodOrder[a.period] - periodOrder[b.period];
  if (pDiff !== 0) return pDiff;
  return (typeOrder[a.activity_type] ?? 999) - (typeOrder[b.activity_type] ?? 999);
});

const toggleStar = async (goalId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const isStarred = starredGoalIds.includes(goalId);

  if (isStarred) {
    await supabase
      .from("goal_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("goal_id", goalId);

    setStarredGoalIds((prev) => prev.filter((id) => id !== goalId));
  } else {
    // Limit to max 2
    if (starredGoalIds.length >= 2) {
      alert("You can select up to 2 goals to show on the home screen.");
      return;
    }

    await supabase.from("goal_preferences").insert({
      user_id: user.id,
      goal_id: goalId,
    });

    setStarredGoalIds((prev) => [...prev, goalId]);
  }
};


  useEffect(() => {
    loadGoals();
  }, []);

  return (
    <div className="min-h-screen bg-movenotes-bg p-4 max-w-md mx-auto">
      
        {/* Add Goal Button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full flex items-center justify-center gap-2 
                   bg-amber-300 border border-amber-400 text-primary-text 
                   py-3 rounded-full text-lg font-medium my-4"
      >
        <span className="text-xl">+</span>
        <Target className="w-5 h-5" />
        <span>Goal</span>
      </button>

      <h2 className="text-sm font-medium text-gray-600 mt-4 mb-2">
        Your Goals
      </h2>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : goals.length === 0 ? (
        <div className="text-center px-6 py-10">
          <h3 className="text-lg font-semibold text-movenotes-primary mb-3">
            Set your first goal
          </h3>
          <p className="text-movenotes-muted leading-relaxed max-w-md mx-auto mb-6">
            A goal gives your movement a bit of shape. It’s not about hitting
            numbers — it’s about creating a rhythm and seeing how your habits
            evolve over time.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
  {sortedGoals.map((g) => (
    <SwipeActions
      key={g.id}
      onEdit={() => setEditingGoal(g)}
    >
      <div className="relative p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-center">

        {/* ⭐ STAR BUTTON */}
        <button
          onClick={(e) => {
            e.stopPropagation();    // prevent triggering Swipe or opening modal
            toggleStar(g.id);
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleStar(g.id);
          }}
          className="absolute top-2 right-2"
        >
          <Star
            className={`w-5 h-5 ${
              starredGoalIds.includes(g.id)
                ? "text-movenotes-accent fill-movenotes-accent"
                : "text-gray-400"
            }`}
          />
        </button>

        {/* TITLE */}
        <div className="font-semibold text-gray-900">
          {g.name || "Goal"}
        </div>

        {/* TARGET */}
        <div className="text-gray-700 text-sm mt-1 flex items-center justify-center gap-2">
          {(() => {
            const typeConfig =
              ACTIVITY_TYPES[g.activity_type] ?? ACTIVITY_TYPES["any"];
            const Icon = typeConfig?.Icon;
            return Icon ? <Icon size={18} strokeWidth={1.7} /> : null;
          })()}
          {g.metric === "distance" && <span>{g.target} km</span>}
          {g.metric === "duration" && <span>{g.target} min</span>}
          {g.metric === "count" && <span>{g.target} activities</span>}
          {!["distance", "duration", "count"].includes(g.metric as string) && (
            <span>{g.target}</span>
          )}
          <span className="uppercase text-[11px] text-gray-500">{g.activity_type}</span>
        </div>
      </div>
    </SwipeActions>
  ))}
</div>
      )}

      {/* Dialogs */}
      {showAdd && (
        <AddGoalModal
          onClose={() => setShowAdd(false)}
          onAdded={loadGoals}
          existingGoals={goals}
          onDuplicate={(goal) => setEditingGoal(goal)}
        />

      )}

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onUpdated={loadGoals}
          onDeleted={(id) => {
            setEditingGoal(null);
            setGoals((prev) => prev.filter((g) => g.id !== id));
          }}
        />
      )}
    </div>
  );
}
