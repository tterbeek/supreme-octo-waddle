// src/pages/Home.tsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import QuickLogForm from "../components/QuickLogForm2";
import { SelectActivityTypeModal } from "../components/SelectActivityTypeModal";
import Toast from "../components/Toast";
import TooltipBubble from "../components/TooltipBubble";
import { IconActivity } from "@tabler/icons-react";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import {
  Zap,
  Frown,
  Meh,
  Smile,
  Laugh,
  Target,
  Hash,
} from "lucide-react";
import SwipeActions from "../components/SwipeActions";
import Sidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import AddNoteModal from "../components/AddNoteModal";
import ActivityEditForm from "../components/ActivityEditForm";
import GoalProgressCard from "../components/GoalProgressCard";
import type { Goal } from "../types";
import { useTooltipManager } from "../hooks/useTooltipManager";

type GoalStat = {
  goal_id: string;
  name: string | null;
  activity_type: keyof typeof ACTIVITY_TYPES | "any";
  metric: "distance" | "duration" | "count";
  period: "week" | "month" | "year";
  target: number;
  current_value: number;
  unit: "km" | "activities" | "min";
  progress_ratio: number;
  comparison_pct: number | null;
};

const GOAL_RPC = "stats_goal_progress";
const NOTE_BUCKET = "actvity-notes"; // adjust if bucket name changes

export default function Home({ useRpcGoals = false }: { useRpcGoals?: boolean }) {
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
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [signedNoteImages, setSignedNoteImages] = useState<Record<string, string>>(
    {}
  );
  const [noteImageOrientation, setNoteImageOrientation] = useState<
    Record<string, "portrait" | "landscape">
  >({});
  const [initialFeedLoaded, setInitialFeedLoaded] = useState(false);
  const { visible, showTooltip, hideTooltip } = useTooltipManager();
  const [lightbox, setLightbox] = useState<{
    url: string;
    activity: any;
  } | null>(null);
  const lightboxOpenedAt = useRef<number>(0);
  const imageTouch = useRef<{ x: number; y: number; moved: boolean }>({
    x: 0,
    y: 0,
    moved: false,
  });
  const logButtonRef = useRef<HTMLButtonElement | null>(null);

  // Quick log
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);

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

  // prevent concurrent loadMoreFeed calls
  const isLoadingMoreRef = useRef(false);

  const activityOrder: Record<GoalStat["activity_type"], number> = {
    run: 0,
    ride: 1,
    any: 2,
  };

  const sortGoalStats = (items: GoalStat[]) =>
    [...items].sort((a, b) => {
      const aOrder = activityOrder[a.activity_type] ?? 99;
      const bOrder = activityOrder[b.activity_type] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || "").localeCompare(b.name || "");
    });

  const comparisonClass = (comparison: number | null) => {
    if (comparison === null) return "";
    if (comparison === 0) return "text-gray-500";
    if (comparison >= 0) return "text-green-600";
    if (comparison >= -5) return "text-gray-500";
    if (comparison >= -15) return "text-yellow-500";
    return "text-red-600";
  };

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  async function refreshActivities() {
    if (!userId) return;

    if (!useRpcGoals) {
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
    } else {
      const { data, error } = await supabase.rpc(GOAL_RPC, { user_id: userId });
      if (!error) setGoalStats((data as GoalStat[]) || []);
    }

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
    setInitialFeedLoaded(true);
  }

  const loadMoreFeed = async () => {
  if (!hasMoreFeed) return;
  if (!userId) return;
  if (isLoadingMoreRef.current) return; // ⛔ already fetching

  isLoadingMoreRef.current = true;

  try {
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

    setActivities((prev) => [...prev, ...more]);
    setFeedOffset((prev) => prev + more.length);

    if (more.length < FEED_PAGE_SIZE) {
      setHasMoreFeed(false);
    }
  } finally {
    isLoadingMoreRef.current = false;
  }
};


  // --------------------------------------------------
  // INITIAL LOAD: user → goals → activitiesForGoals + feed
  // --------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
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

        if (useRpcGoals) {
          // 3a) Goal stats from Supabase RPC
          const { data: stats, error: statsErr } = await supabase.rpc(GOAL_RPC, {
            user_id: user.id,
          });
          if (!statsErr) setGoalStats((stats as GoalStat[]) || []);
        } else {
          // 3b) Activities for goals (last 60 days) for client-side calc
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
        }

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
      } finally {
        setInitialFeedLoaded(true);
      }
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

  const homeGoalStats = sortGoalStats(
    goalStats.filter((g) => selectedGoals.includes(g.goal_id))
  ).slice(0, 3);

  const showGoalSection = useRpcGoals
    ? homeGoalStats.length > 0
    : homeGoals.length > 0;

  const displayedGoalStats = homeGoalStats.slice(0, 2);
  const displayedLegacyGoals = homeGoals.slice(0, 2);
  const displayedCount = useRpcGoals
    ? displayedGoalStats.length
    : displayedLegacyGoals.length;

  const goalGridClass =
    displayedCount === 1
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 sm:grid-cols-2 gap-3";

  // --------------------------------------------------
  // SIGNED URLS FOR NOTE IMAGES (feeds)
  // --------------------------------------------------
  useEffect(() => {
    const withImages = activities.filter((a) => a.note_image_url);
    if (withImages.length === 0) {
      setSignedNoteImages({});
      return;
    }

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        withImages.map(async (a) => {
          const path = a.note_image_url as string;
          const { data, error } = await supabase.storage
            .from(NOTE_BUCKET)
            .createSignedUrl(path, 86400); // 24h
          if (error) return [a.id, null] as const;
          return [a.id, data?.signedUrl || null] as const;
        })
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        if (url) map[id] = url;
      });
      setSignedNoteImages(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [activities]);

  const GoalStatCardHome = ({ stat }: { stat: GoalStat }) => {
    const ratio = Math.max(0, Math.min(1, Number(stat.progress_ratio) || 0));
    const comparison =
      stat.comparison_pct === null ? null : Math.round(stat.comparison_pct);
    const typeConfig =
      ACTIVITY_TYPES[stat.activity_type] ?? ACTIVITY_TYPES["any"];
    const ActivityIcon = typeConfig?.Icon || Target;
    const MetricIcon =
      stat.metric === "distance"
        ? Target
        : stat.metric === "duration"
        ? Hash
        : Hash;

    return (
      <div className="rounded-xl bg-warm-100 border border-warm-200 shadow-sm px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <ActivityIcon size={20} strokeWidth={1.8} />
          <MetricIcon className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="font-semibold text-gray-800 text-sm tracking-wide">
            {stat.name || `${typeConfig.label} ${stat.metric}`}
          </h3>
        </div>

        <div className="text-base text-gray-900 font-medium">
          {stat.metric === "distance" && (
            <>
              {Math.round(stat.current_value)} / {Math.round(stat.target)} km
            </>
          )}
          {stat.metric === "duration" && (
            <>
              {Math.round(stat.current_value)} / {Math.round(stat.target)} min
            </>
          )}
          {stat.metric === "count" && (
            <>
              {Math.round(stat.current_value)} / {Math.round(stat.target)} activities
            </>
          )}
        </div>

        <div className="flex gap-1 mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full ${
                i < Math.floor(ratio * 5)
                  ? "bg-movenotes-accent"
                  : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        {comparison !== null && (
          <p className={`text-sm mt-1 ${comparisonClass(comparison)}`}>
            {comparison === 0
              ? "no change from previous period"
              : `${comparison >= 0 ? "↑" : "↓"} ${comparison}% vs previous`}
          </p>
        )}
      </div>
    );
  };

  const hasDoneOnboarding =
    typeof window !== "undefined" &&
    localStorage.getItem("movenotes_onboarding_done") === "true";
  const showFirstLogPrompt =
    hasDoneOnboarding && activities.length === 0 && initialFeedLoaded;

  useEffect(() => {
    if (!hasDoneOnboarding) return;
    if (initialFeedLoaded && activities.length === 0) {
      showTooltip("home_log_button");
    }
  }, [activities.length, initialFeedLoaded, showTooltip, hasDoneOnboarding]);

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
        {showFirstLogPrompt && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl mb-4">
            <p className="font-medium mb-2">Welcome to MoveNotes ✨</p>
            <p className="text-sm mb-3">
              Start your movement story by logging your first activity.
            </p>
            <button
              onClick={() => setShowTypeSelector(true)}
              className="bg-movenotes-primary text-primary-text px-4 py-2 rounded-full text-sm font-medium"
            >
              Log my first activity
            </button>
          </div>
        )}

        {showGoalSection && (
          <div
            className="bg-warm-100 border border-warm-200 rounded-xl p-4 shadow-sm mt-4 mb-6"
            onClick={() => navigate(useRpcGoals ? "/stats" : "/stats-legacy")}
          >
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Your Goals
            </h2>

            <div className={goalGridClass}>
              {useRpcGoals
                ? displayedGoalStats.map((g) => (
                    <GoalStatCardHome key={g.goal_id} stat={g} />
                  ))
                : displayedLegacyGoals.map((g) => (
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

        <div className="relative inline-block w-full">
          <button
            ref={logButtonRef}
            onClick={() => {
              hideTooltip();
              setShowTypeSelector(true);
            }}
            className="w-full flex items-center justify-center gap-2 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full text-lg font-medium my-2 transition transform hover:-translate-y-0.5 active:scale-95"
          >
            <span className="text-xl">+</span>
            <IconActivity size={20} strokeWidth={1.8} />
            <span>Activity</span>
          </button>

          {visible === "home_log_button" && (
            <TooltipBubble position="top" onClose={hideTooltip}>
              Tap here to log your first movement
            </TooltipBubble>
          )}
        </div>

        {/* -------------------------------------------------- */}
        {/* RECENT HISTORY                                     */}
        {/* -------------------------------------------------- */}
        <h2 className="text-sm font-medium text-gray-500 mt-6 mb-2">
          Recent Activity
        </h2>

        <div className="flex flex-col gap-3">
          {activities.map((a, idx) => {
            const typeConfig = ACTIVITY_TYPES[a.type] ?? ACTIVITY_TYPES["other"];
            const TypeIcon = typeConfig.Icon;
            const showAfterLogTooltip = visible === "after_first_log" && idx === 0;
            return (
              <SwipeActions
                key={a.id}
                onEdit={() => setEditActivity(a)}
                disabled={!!lightbox}
              >
                <div
                  className="
                    relative rounded-xl p-5 bg-warm-100 border border-warm-200 shadow-sm text-center
                    w-full mx-auto
                    max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl
                    sm:p-6 md:p-7
                  "
                  onClick={() => {
                    hideTooltip();
                    setEditActivity(a);
                  }}
                >
                  {showAfterLogTooltip && (
                    <TooltipBubble position="top" onClose={hideTooltip}>
                    Create a preset to make logging this activity faster next time.
                    </TooltipBubble>
                  )}

                  {/* Icon + Title */}
                  <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
                    <TypeIcon size={24} strokeWidth={1.8} />
                    <span className="font-semibold text-gray-900 text-base md:text-lg leading-tight">
                      {a.title || typeConfig.label}
                    </span>
                  </div>

                  {/* Distance/Duration + Date */}
                  <div className="text-sm md:text-base text-gray-700 flex items-center justify-center gap-2 mb-1 flex-wrap">
                    {a.distance_km != null && (
                      <>
                        <span>{a.distance_km} km</span>
                        <span className="text-gray-400">·</span>
                      </>
                    )}
                    {a.duration_min != null && (
                      <>
                        <span>{a.duration_min} min</span>
                        <span className="text-gray-400">·</span>
                      </>
                    )}
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
                  {(a.notes?.trim() || signedNoteImages[a.id]) && (
                    <div className="mt-3 space-y-2">
                      {a.notes?.trim() && (
                        <p
                          className="
                            text-[15px] md:text[17px]
                            text-gray-600 font-[DMSerifDisplay] italic leading-snug
                            max-w-xs sm:max-w-sm md:max-w-md mx-auto
                          "
                        >
                          “{a.notes}”
                        </p>
                      )}

                      {signedNoteImages[a.id] && (
                        <div>
                          <img
                            src={signedNoteImages[a.id]}
                            alt="Activity note"
                            loading="lazy"
                            className={`
                              rounded-xl border border-warm-200 shadow-sm
                              ${
                                noteImageOrientation[a.id] === "portrait"
                                  ? "max-h-80 w-auto max-w-full mx-auto object-contain"
                                  : "w-full max-h-56 object-cover"
                              }
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              lightboxOpenedAt.current = Date.now();
                              setLightbox({ url: signedNoteImages[a.id], activity: a });
                            }}
                            onTouchStart={(e) => {
                              const t = e.touches[0];
                              imageTouch.current = { x: t.clientX, y: t.clientY, moved: false };
                            }}
                            onTouchMove={(e) => {
                              const t = e.touches[0];
                              const dx = Math.abs(t.clientX - imageTouch.current.x);
                              const dy = Math.abs(t.clientY - imageTouch.current.y);
                              if (dx > 8 || dy > 8) {
                                imageTouch.current.moved = true;
                              }
                            }}
                            onTouchEnd={(e) => {
                              if (imageTouch.current.moved) return; // treat as scroll, do nothing
                              e.stopPropagation();
                              lightboxOpenedAt.current = Date.now();
                              setLightbox({ url: signedNoteImages[a.id], activity: a });
                            }}
                            onLoad={(e) => {
                              const { naturalWidth, naturalHeight } = e.currentTarget;
                              setNoteImageOrientation((prev) => ({
                                ...prev,
                                [a.id]:
                                  naturalHeight > naturalWidth ? "portrait" : "landscape",
                              }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SwipeActions>
            );
          })}
        </div>

        {/* -------------------------------------------------- */}
        {/* MODALS & TOASTS                                    */}
        {/* -------------------------------------------------- */}
        <SelectActivityTypeModal
          open={showTypeSelector}
          onClose={() => setShowTypeSelector(false)}
          onSelect={(typeId) => {
            setSelectedType(typeId);
            setShowTypeSelector(false);
            setShowQuickLog(true);
          }}
        />

        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
            onClick={(e) => {
              // ignore the immediate click that follows the tap that opened the lightbox
              if (Date.now() - lightboxOpenedAt.current < 300) {
                e.stopPropagation();
                return;
              }
              setLightbox(null);
            }}
          >
            <button
              aria-label="Close"
              className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(null);
              }}
            >
              ×
            </button>
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                <div className="absolute inset-4 rounded-3xl pointer-events-none shadow-md shadow-[rgba(0,0,0,0.15)]" />
                <img
                  src={lightbox.url}
                  alt="Activity note full size"
                  className="relative max-h-full max-w-full object-contain rounded-3xl"
                />
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.18) 100%)",
                  }}
                />
              </div>
            </div>
            <div className="pb-6 px-6 text-center text-sm text-white/80">
              {lightbox.activity?.date && (
                <span>
                  {new Date(lightbox.activity.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              {lightbox.activity?.distance_km && (
                <span className="mx-2">•</span>
              )}
              {lightbox.activity?.distance_km && (
                <span>{Number(lightbox.activity.distance_km).toFixed(1)} km</span>
              )}
              {lightbox.activity?.duration_min && (
                <>
                  <span className="mx-2">•</span>
                  <span>{Number(lightbox.activity.duration_min)} min</span>
                </>
              )}
              {lightbox.activity?.type && (
                <span className="mx-2">•</span>
              )}
              {lightbox.activity?.type && (
                <span className="uppercase">{lightbox.activity.type}</span>
              )}
            </div>
          </div>
        )}

        {showQuickLog && (
          <QuickLogForm
            initialType={selectedType ?? "run"}
            onClose={() => {
              setShowQuickLog(false);
            }}
            onLogged={async (activityId) => {
              showTooltip("after_first_log");
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
