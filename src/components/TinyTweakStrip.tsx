import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import MicroAdjustmentCreateModal from "./MicroAdjustmentCreateModal";

type TinyTweakStripProps = {
  userId: string | null;
};

type TinyTweak = {
  id: string;
  text: string;
  started_at: string | null;
};

const ACTIVE_WINDOW_DAYS = 7;
const ACTIVE_WINDOW_MS = ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export default function TinyTweakStrip({ userId }: TinyTweakStripProps) {
  const [activeTweak, setActiveTweak] = useState<TinyTweak | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const fetchActiveTweak = useCallback(async () => {
    if (!userId) {
      setActiveTweak(null);
      return;
    }

    const { data, error } = await supabase
      .from("micro_adjustments")
      .select("id, text, started_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[TinyTweak] Fetch failed:", error.message);
      setActiveTweak(null);
      return;
    }

    const tweak = data?.[0] ?? null;
    if (!tweak?.started_at) {
      setActiveTweak(null);
      return;
    }

    const startedAt = new Date(tweak.started_at);
    if (Number.isNaN(startedAt.getTime())) {
      setActiveTweak(null);
      return;
    }

    const isFresh = Date.now() - startedAt.getTime() <= ACTIVE_WINDOW_MS;
    if (!isFresh) {
      setActiveTweak(null);
      supabase
        .from("micro_adjustments")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", tweak.id)
        .eq("user_id", userId);
      return;
    }

    setActiveTweak(tweak);
  }, [userId]);

  useEffect(() => {
    fetchActiveTweak();
  }, [fetchActiveTweak]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchActiveTweak();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchActiveTweak]);

  if (!activeTweak) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowAdjustModal(true)}
        className="w-full text-left bg-movenotes-surface border border-movenotes-border rounded-xl px-4 py-3 shadow-sm transition hover:-translate-y-0.5"
      >
        <div className="text-xs uppercase tracking-wide text-movenotes-muted">
          Tiny tweak
        </div>
        <div
          className="text-sm text-movenotes-text font-medium mt-1 overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {activeTweak.text}
        </div>
      </button>

      <MicroAdjustmentCreateModal
        open={showAdjustModal}
        mode="adjust"
        activeTweak={{ id: activeTweak.id, text: activeTweak.text }}
        onClose={() => setShowAdjustModal(false)}
        onCompleted={fetchActiveTweak}
      />
    </>
  );
}
