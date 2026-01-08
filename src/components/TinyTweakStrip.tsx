import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import MicroAdjustmentCreateModal from "./MicroAdjustmentCreateModal";
import TooltipBubble from "./TooltipBubble";

type TinyTweakStripProps = {
  userId: string | null;
  tooltipVisible?: boolean;
  onTooltipClose?: () => void;
};

type TinyTweak = {
  id: string;
  text: string;
  started_at: string | null;
};

const ACTIVE_WINDOW_DAYS = 7;
const ACTIVE_WINDOW_MS = ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export default function TinyTweakStrip({
  userId,
  tooltipVisible = false,
  onTooltipClose,
}: TinyTweakStripProps) {
  const [activeTweak, setActiveTweak] = useState<TinyTweak | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "adjust" | null>(null);

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

  useEffect(() => {
    if (activeTweak && tooltipVisible) {
      onTooltipClose?.();
    }
  }, [activeTweak, tooltipVisible, onTooltipClose]);

  const handleTooltipClose = () => {
    onTooltipClose?.();
  };

  const handleAddTinyTweak = () => {
    handleTooltipClose();
    setModalMode("create");
  };

  const shouldShowTooltip = tooltipVisible && !activeTweak;
  const shouldRenderStrip = !!activeTweak || shouldShowTooltip || modalMode !== null;

  if (!shouldRenderStrip) return null;

  return (
    <>
      <div className="relative">
        {shouldShowTooltip && (
          <TooltipBubble
            position="bottom"
            onClose={handleTooltipClose}
            className="w-[calc(100vw-3rem-30px)] max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl"
            wrapperClassName="-mt-[75px]"
          >
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">
                Curious to try something new?
              </p>
              <p className="text-sm text-gray-700">
                Tiny Tweaks are small ideas you can experiment with next time you move.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddTinyTweak}
                  className="text-movenotes-primary text-sm font-semibold underline text-left"
                >
                  Add Tiny Tweak
                </button>
                <button
                  type="button"
                  onClick={handleTooltipClose}
                  className="text-sm text-gray-500 underline text-left"
                >
                  Not now
                </button>
              </div>
            </div>
          </TooltipBubble>
        )}

        {activeTweak ? (
          <button
            type="button"
            onClick={() => setModalMode("adjust")}
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
        ) : (
          <div
            aria-hidden="true"
            className="w-full text-left bg-movenotes-surface border border-movenotes-border rounded-xl px-4 py-3 shadow-sm opacity-0 pointer-events-none"
          >
            <div className="text-xs uppercase tracking-wide text-movenotes-muted">
              Tiny tweak
            </div>
            <div className="text-sm text-movenotes-text font-medium mt-1">
              Placeholder
            </div>
          </div>
        )}
      </div>

      <MicroAdjustmentCreateModal
        open={modalMode !== null}
        mode={modalMode ?? "create"}
        activeTweak={
          modalMode === "adjust" && activeTweak
            ? { id: activeTweak.id, text: activeTweak.text }
            : null
        }
        onClose={() => setModalMode(null)}
        onCompleted={fetchActiveTweak}
      />
    </>
  );
}
