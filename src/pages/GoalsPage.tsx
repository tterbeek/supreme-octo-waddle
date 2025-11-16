// src/pages/GoalsPage.tsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import HeaderLogo from "../components/HeaderLogo";
import SwipeActions from "../components/SwipeActions";
import AddGoalModal from "../components/AddGoalModal";
import EditGoalModal from "../components/EditGoalModal";
import type { Goal } from "../types";
import { Target } from "lucide-react";

export default function GoalsPage() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

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

const typeOrder: Record<"run" | "ride" | "any", number> = {
  any: 1,
  ride: 2,
  run: 3,
};

const sortedGoals = [...goals].sort((a, b) => {
  const pDiff = periodOrder[a.period] - periodOrder[b.period];
  if (pDiff !== 0) return pDiff;
  return typeOrder[a.activity_type] - typeOrder[b.activity_type];
});


  useEffect(() => {
    loadGoals();
  }, []);

  return (
    <div className="min-h-screen bg-movenotes-bg p-4 max-w-md mx-auto">
      <HeaderLogo />
      <button onClick={() => navigate("/")} className="text-sm underline mt-2">
        ← Back
      </button>

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
        <p className="text-gray-500 italic">No goals yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedGoals.map((g) => (
            <SwipeActions
              key={g.id}
              onEdit={() => setEditingGoal(g)}
              onDelete={() => setEditingGoal(g)}
            >
              <div className="p-4 bg-warm-100 border border-warm-200 rounded-xl shadow-sm text-center">
                <div className="font-semibold text-gray-900">
                  {g.name || "Goal"}
                </div>
                <div className="text-gray-700 text-sm mt-1">
                  {g.metric === "distance"
                    ? `${g.target} km`
                    : `${g.target} activities`}
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
