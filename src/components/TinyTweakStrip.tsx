import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import MicroAdjustmentCreateModal from "./MicroAdjustmentCreateModal";
import ModalSheet from "./ModalSheet";
import TooltipBubble from "./TooltipBubble";

type TinyTweakStripProps = {
  userId: string | null;
  tooltipVisible?: boolean;
  onTooltipClose?: () => void;
};

type EndFlowState = "none" | "prompt_reflection" | "prompt_renew" | "renew_dismissed";

type TinyTweak = {
  id: string;
  text: string;
  started_at: string | null;
  ended_at?: string | null;
  end_flow_state?: EndFlowState | null;
};

const ACTIVE_ACTIVITY_LIMIT = 7;

export default function TinyTweakStrip({
  userId,
  tooltipVisible = false,
  onTooltipClose,
}: TinyTweakStripProps) {
  const [activeTweak, setActiveTweak] = useState<TinyTweak | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "adjust" | null>(null);
  const [endFlowTweak, setEndFlowTweak] = useState<TinyTweak | null>(null);
  const [reflectionModalOpen, setReflectionModalOpen] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [savingReflection, setSavingReflection] = useState(false);
  const [renewingFromTweakId, setRenewingFromTweakId] = useState<string | null>(null);

  const fetchEndFlowTweak = useCallback(
    async (candidate?: TinyTweak | null) => {
      if (!userId) {
        setEndFlowTweak(null);
        return;
      }

      let endedTweak = candidate ?? null;

      if (!endedTweak) {
        const { data, error } = await supabase
          .from("micro_adjustments")
          .select("id, text, started_at, ended_at, end_flow_state")
          .eq("user_id", userId)
          .eq("status", "ended")
          .in("end_flow_state", ["prompt_reflection", "prompt_renew"])
          .order("ended_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("[TinyTweak] Ended fetch failed:", error.message);
          setEndFlowTweak(null);
          return;
        }

        endedTweak = data?.[0] ?? null;
      }

      if (!endedTweak?.id || !endedTweak.end_flow_state) {
        setEndFlowTweak(null);
        return;
      }

      if (endedTweak.end_flow_state === "prompt_reflection") {
        const { data: reflectionRows, error: reflectionError } = await supabase
          .from("journal_entries")
          .select("id")
          .eq("user_id", userId)
          .eq("entry_type", "tiny_tweak_reflection")
          .eq("related_tiny_tweak_id", endedTweak.id)
          .limit(1);

        if (reflectionError) {
          console.error("[TinyTweak] Reflection lookup failed:", reflectionError.message);
          setEndFlowTweak(endedTweak);
          return;
        }

        if (reflectionRows && reflectionRows.length > 0) {
          const { error: updateError } = await supabase
            .from("micro_adjustments")
            .update({ end_flow_state: "prompt_renew" })
            .eq("id", endedTweak.id)
            .eq("user_id", userId);
          if (updateError) {
            console.error("[TinyTweak] Renew update failed:", updateError.message);
            setEndFlowTweak({ ...endedTweak, end_flow_state: "prompt_renew" });
            return;
          }
          setEndFlowTweak({ ...endedTweak, end_flow_state: "prompt_renew" });
          return;
        }
      }

      setEndFlowTweak(endedTweak);
    },
    [userId]
  );

  const fetchActiveTweak = useCallback(async () => {
    if (!userId) {
      setActiveTweak(null);
      setEndFlowTweak(null);
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
      await fetchEndFlowTweak();
      return;
    }

    const startedAt = new Date(tweak.started_at);
    if (Number.isNaN(startedAt.getTime())) {
      setActiveTweak(null);
      await fetchEndFlowTweak();
      return;
    }

    const { count, error: countError } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", tweak.started_at);

    if (countError) {
      console.error("[TinyTweak] Activity count failed:", countError.message);
      setActiveTweak(tweak);
      setEndFlowTweak(null);
      return;
    }

    const activityCount = count ?? 0;
    const isWithinLimit = activityCount < ACTIVE_ACTIVITY_LIMIT;
    if (!isWithinLimit) {
      const endedAt = new Date().toISOString();
      setActiveTweak(null);
      const { error: endError } = await supabase
        .from("micro_adjustments")
        .update({
          status: "ended",
          ended_at: endedAt,
          end_flow_state: "prompt_reflection",
        })
        .eq("id", tweak.id)
        .eq("user_id", userId)
        .eq("status", "active");
      if (endError) {
        console.error("[TinyTweak] End failed:", endError.message);
      }
      await fetchEndFlowTweak({
        ...tweak,
        ended_at: endedAt,
        end_flow_state: "prompt_reflection",
      });
      return;
    }

    setActiveTweak(tweak);
    setEndFlowTweak(null);
  }, [fetchEndFlowTweak, userId]);

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
    if ((activeTweak || endFlowTweak) && tooltipVisible) {
      onTooltipClose?.();
    }
  }, [activeTweak, endFlowTweak, tooltipVisible, onTooltipClose]);

  useEffect(() => {
    if (endFlowTweak) {
      setReflectionText("");
      setReflectionError(null);
    }
  }, [endFlowTweak?.id]);

  const handleTooltipClose = () => {
    onTooltipClose?.();
  };

  const handleAddTinyTweak = () => {
    handleTooltipClose();
    setRenewingFromTweakId(null);
    setModalMode("create");
  };

  const showReflectionPrompt = endFlowTweak?.end_flow_state === "prompt_reflection";
  const showRenewPrompt = endFlowTweak?.end_flow_state === "prompt_renew";
  const shouldShowTooltip = tooltipVisible && !activeTweak && !endFlowTweak;
  const shouldRenderStrip =
    !!activeTweak ||
    !!endFlowTweak ||
    shouldShowTooltip ||
    modalMode !== null ||
    reflectionModalOpen;
  const cardClassName =
    "relative w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto text-left bg-movenotes-bgoverlay border border-movenotes-border/80 rounded-xl px-5 py-4 sm:px-6 sm:py-5 overflow-hidden before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-movenotes-muted/40 before:rounded-l-xl";
  const trimmedReflection = reflectionText.trim();
  const canSaveReflection = trimmedReflection.length > 0;

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
            className={cardClassName}
          >
            <div className="text-[11px] uppercase tracking-[0.2em] text-movenotes-text/70">
              Tiny tweak
            </div>
            <div
              className="text-sm text-movenotes-text font-medium mt-1 leading-relaxed overflow-hidden"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {activeTweak.text}
            </div>
          </button>
        ) : showReflectionPrompt && endFlowTweak ? (
          <div className={cardClassName}>
            <div className="text-[11px] uppercase tracking-[0.2em] text-movenotes-muted">
              Tiny tweak
            </div>
            <p className="mt-2 text-sm text-movenotes-text/80 italic">
              "{endFlowTweak.text}"
            </p>
            <p className="mt-3 text-sm text-movenotes-text/70">Did it help - or not?</p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => {
                  setReflectionError(null);
                  setReflectionModalOpen(true);
                }}
                className="text-movenotes-primary font-semibold underline"
              >
                Add reflection
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!endFlowTweak || !userId) return;
                  const { error: skipError } = await supabase
                    .from("micro_adjustments")
                    .update({ end_flow_state: "prompt_renew" })
                    .eq("id", endFlowTweak.id)
                    .eq("user_id", userId);
                  if (skipError) {
                    console.error("[TinyTweak] Skip failed:", skipError.message);
                    return;
                  }
                  setEndFlowTweak({ ...endFlowTweak, end_flow_state: "prompt_renew" });
                }}
                className="text-movenotes-muted underline"
              >
                Skip
              </button>
            </div>
          </div>
        ) : showRenewPrompt && endFlowTweak ? (
          <div className={cardClassName}>
            <div className="text-[11px] uppercase tracking-[0.2em] text-movenotes-muted">
              Tiny tweak
            </div>
            <p className="mt-2 text-sm text-movenotes-text/80">
              Try another Tiny Tweak?
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => {
                  setRenewingFromTweakId(endFlowTweak.id);
                  setModalMode("create");
                }}
                className="text-movenotes-primary font-semibold underline"
              >
                Add new Tiny Tweak
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!endFlowTweak || !userId) return;
                  const { error: dismissError } = await supabase
                    .from("micro_adjustments")
                    .update({ end_flow_state: "renew_dismissed" })
                    .eq("id", endFlowTweak.id)
                    .eq("user_id", userId);
                  if (dismissError) {
                    console.error("[TinyTweak] Renew dismiss failed:", dismissError.message);
                    return;
                  }
                  setEndFlowTweak(null);
                  setRenewingFromTweakId(null);
                }}
                className="text-movenotes-muted underline"
              >
                No, not now
              </button>
            </div>
          </div>
        ) : (
          <div
            aria-hidden="true"
            className={`${cardClassName} opacity-0 pointer-events-none`}
          >
            <div className="text-[11px] uppercase tracking-[0.2em] text-movenotes-text/70">
              Tiny tweak
            </div>
            <div className="text-sm text-movenotes-text font-medium mt-1 leading-relaxed">
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
        onCompleted={async () => {
          await fetchActiveTweak();
          if (renewingFromTweakId && userId) {
            const { error: clearError } = await supabase
              .from("micro_adjustments")
              .update({ end_flow_state: "none" })
              .eq("id", renewingFromTweakId)
              .eq("user_id", userId);
            if (clearError) {
              console.error("[TinyTweak] Renew clear failed:", clearError.message);
            }
          }
          setRenewingFromTweakId(null);
        }}
      />

      {reflectionModalOpen && showReflectionPrompt && endFlowTweak && (
        <ModalSheet
          onClose={() => setReflectionModalOpen(false)}
          sheetClassName="max-w-md md:max-w-2xl"
        >
          <div className="text-[11px] uppercase tracking-[0.2em] text-movenotes-muted text-center">
            Tiny tweak
          </div>
          <p className="mt-2 text-sm text-movenotes-text/80 italic text-center">
            "{endFlowTweak.text}"
          </p>
          <p className="text-xs text-movenotes-muted mt-2 text-center">
            This will be saved as a Tiny Tweak note in your journal.
          </p>
          <textarea
            value={reflectionText}
            onChange={(e) => {
              setReflectionText(e.target.value);
              setReflectionError(null);
            }}
            placeholder="Did trying this change anything? Even slightly?"
            rows={5}
            className="w-full border border-movenotes-border rounded-lg p-3 bg-movenotes-bg text-movenotes-text resize-none focus:ring-2 focus:ring-movenotes-primary outline-none mt-4"
          />
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              type="button"
              className="w-full text-center text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-full py-3"
              onClick={() => setReflectionModalOpen(false)}
              disabled={savingReflection}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!endFlowTweak || !userId || savingReflection) return;
                if (!canSaveReflection) {
                  setReflectionError("Please add a reflection.");
                  return;
                }
                setSavingReflection(true);
                setReflectionError(null);
                const { error: saveError } = await supabase
                  .from("journal_entries")
                  .insert({
                    user_id: userId,
                    entry_type: "tiny_tweak_reflection",
                    text: trimmedReflection,
                    related_tiny_tweak_id: endFlowTweak.id,
                    metadata: { tiny_tweak_text: endFlowTweak.text },
                  });
                if (saveError) {
                  console.error("[TinyTweak] Reflection save failed:", saveError.message);
                  setReflectionError("Unable to save reflection right now.");
                  setSavingReflection(false);
                  return;
                }
                const { error: updateError } = await supabase
                  .from("micro_adjustments")
                  .update({ end_flow_state: "prompt_renew" })
                  .eq("id", endFlowTweak.id)
                  .eq("user_id", userId);
                if (updateError) {
                  console.error("[TinyTweak] Renew update failed:", updateError.message);
                }
                setSavingReflection(false);
                setReflectionModalOpen(false);
                setReflectionText("");
                setEndFlowTweak({ ...endFlowTweak, end_flow_state: "prompt_renew" });
              }}
              disabled={!canSaveReflection || savingReflection}
              className="w-full py-3 rounded-full bg-amber-300 border border-amber-400 text-primary-text font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingReflection ? "Saving..." : "Save reflection"}
            </button>
          </div>
          {reflectionError && (
            <p className="text-sm text-red-600 text-center mt-3">{reflectionError}</p>
          )}
        </ModalSheet>
      )}
    </>
  );
}
