import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import ModalSheet from "./ModalSheet";

type Suggestion = {
  id: string;
  text: string;
  short_text?: string | null;
  category: string;
};

type MicroAdjustmentCreateModalProps = {
  open: boolean;
  onClose: () => void;
  mode?: "create" | "adjust";
  activeTweak?: { id: string; text: string } | null;
  onCompleted?: () => void;
};

const SURFACE = "micro_adjustment_create_modal";
const RPC_NAME = "get_micro_adjustment_suggestions_rotating";

const isRpcSignatureError = (err: any) => {
  const msg = typeof err?.message === "string" ? err.message.toLowerCase() : "";
  return (
    err?.code === "PGRST202" ||
    msg.includes("schema cache") ||
    msg.includes("no function matches") ||
    msg.includes("could not find the function") ||
    msg.includes("missing required")
  );
};

export default function MicroAdjustmentCreateModal({
  open,
  onClose,
  mode = "create",
  activeTweak = null,
  onCompleted,
}: MicroAdjustmentCreateModalProps) {
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(
    null
  );
  const [customText, setCustomText] = useState("");
  const [customEdited, setCustomEdited] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmedCustom = useMemo(() => customText.trim(), [customText]);
  const canSave = trimmedCustom.length > 0;
  const isAdjustMode = mode === "adjust" && !!activeTweak;

  useEffect(() => {
    if (!open) return;
    let active = true;

    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      setSuggestions([]);
      setSelectedSuggestionId(null);
      setCustomText(isAdjustMode ? activeTweak?.text ?? "" : "");
      setCustomEdited(false);
      setSuggestionsError(null);
      setSaveError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) {
          setSuggestionsError("Suggestions unavailable");
          setLoadingSuggestions(false);
        }
        return;
      }

      const rpcParamSets = [
        { user_id: user.id, n: 3 },
        {
          user_id: user.id,
          n: 3,
          exclude_shown_days: null,
          exclude_selected_days: null,
        },
        { p_user_id: user.id, p_n: 3 },
        {
          p_user_id: user.id,
          p_n: 3,
          p_exclude_shown_days: null,
          p_exclude_selected_days: null,
        },
      ];

      let resolvedData: Suggestion[] | null = null;
      let resolvedError: any = null;

      for (const params of rpcParamSets) {
        const { data, error } = await supabase.rpc(RPC_NAME, params);
        if (!error) {
          resolvedData = data as Suggestion[];
          resolvedError = null;
          break;
        }
        resolvedError = error;
        if (!isRpcSignatureError(error)) {
          break;
        }
      }

      if (!active) return;

      if (resolvedError || !Array.isArray(resolvedData)) {
        if (resolvedError) {
          console.error(
            "[MicroAdjustment] Suggestions RPC failed:",
            resolvedError.message ?? resolvedError
          );
        }
        setSuggestionsError("Suggestions unavailable");
        setLoadingSuggestions(false);
        return;
      }

      setSuggestions(resolvedData);
      setLoadingSuggestions(false);

      if (resolvedData.length > 0) {
        const { error: logError } = await supabase
          .from("micro_adjustment_suggestion_events")
          .insert(
            resolvedData.map((suggestion: Suggestion) => ({
              user_id: user.id,
              suggestion_id: suggestion.id,
              event_type: "shown",
              surface: SURFACE,
            }))
          );
        if (logError) {
          console.error("[MicroAdjustment] shown log failed:", logError.message);
        }
      }
    };

    fetchSuggestions();

    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  const handleEnd = async () => {
    if (!isAdjustMode || !activeTweak || saving) return;
    setSaveError(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaveError("Unable to save right now.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("micro_adjustments")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        end_flow_state: "prompt_reflection",
      })
      .eq("id", activeTweak.id)
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) {
      setSaveError("Unable to end tiny tweak right now.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
    onCompleted?.();
  };

  const handleSave = async () => {
    if (saving) return;
    setSaveError(null);

    const finalText = trimmedCustom;
    const selected = suggestions.find((s) => s.id === selectedSuggestionId);
    const useSuggestion = !!selected && finalText === selected.text;
    const useCustom = finalText.length > 0 && !useSuggestion;

    if (finalText.length === 0) return;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaveError("Unable to save right now.");
      setSaving(false);
      return;
    }

    if (isAdjustMode && activeTweak) {
      const { error: endError } = await supabase
        .from("micro_adjustments")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          end_flow_state: "prompt_reflection",
        })
        .eq("id", activeTweak.id)
        .eq("user_id", user.id)
        .eq("status", "active");
      if (endError) {
        setSaveError("Unable to update tiny tweak right now.");
        setSaving(false);
        return;
      }
    }

    if (useSuggestion && selected) {
      const { error: selectedError } = await supabase
        .from("micro_adjustment_suggestion_events")
        .insert({
          user_id: user.id,
          suggestion_id: selected.id,
          event_type: "selected",
          surface: SURFACE,
        });
      if (selectedError) {
        console.error("[MicroAdjustment] selected log failed:", selectedError.message);
      }
    }

    const insertPayload = useCustom
      ? {
          user_id: user.id,
          text: finalText,
          source: "custom",
          suggestion_id: null,
          category: null,
          status: "active",
        }
      : {
          user_id: user.id,
          text: selected?.text ?? "",
          source: "suggestion",
          suggestion_id: selected?.id ?? null,
          category: selected?.category ?? null,
          status: "active",
        };

    const { error: insertError } = await supabase
      .from("micro_adjustments")
      .insert(insertPayload);

    if (insertError) {
      const isUniqueViolation =
        insertError.code === "23505" ||
        insertError.message?.toLowerCase().includes("duplicate");
      setSaveError(
        isUniqueViolation
          ? "You already have an active tiny tweak."
          : "Unable to save right now."
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
    onCompleted?.();
  };

  return (
    <ModalSheet onClose={onClose}>
      <h2 className="text-lg font-semibold text-center text-gray-800 mb-4">
        Tiny tweak
      </h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Suggestions</p>
        {loadingSuggestions && (
          <p className="text-sm text-gray-500">Loading suggestions...</p>
        )}
        {!loadingSuggestions && suggestionsError && (
          <p className="text-sm text-gray-500">Suggestions unavailable</p>
        )}
        {!loadingSuggestions && !suggestionsError && (
          <div className="flex flex-col gap-3">
            {suggestions.map((suggestion) => {
              const isSelected = selectedSuggestionId === suggestion.id;
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => {
                    setSelectedSuggestionId(suggestion.id);
                    setCustomText(suggestion.text);
                    setCustomEdited(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl shadow-sm text-gray-900 transition transform hover:-translate-y-0.5 active:scale-95 ${
                    isSelected
                      ? customEdited
                        ? "border border-amber-200 bg-amber-50"
                        : "border border-amber-400 bg-amber-100"
                      : "border border-warm-200 bg-warm-100"
                  }`}
                >
                  <span className="text-sm font-medium text-center">
                    {suggestion.text}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm text-gray-600" htmlFor="tiny-tweak-text">
          {isAdjustMode || selectedSuggestionId
            ? "Adjust it if you like"
            : "Or write your own"}
        </label>
        <textarea
          id="tiny-tweak-text"
          className="w-full border rounded p-2 mt-2 min-h-[90px]"
          placeholder="What would help right now?"
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
            setCustomEdited(true);
          }}
        />
      </div>

      {isAdjustMode && (
        <button
          type="button"
          onClick={handleEnd}
          disabled={saving}
          className="mt-4 text-sm text-gray-600 hover:text-gray-800 text-left"
        >
          End tiny tweak
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 mt-5">
        <button
          type="button"
          className="w-full text-center text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-full py-3"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-3 rounded-full bg-amber-300 border border-amber-400 text-primary-text font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {saveError && (
        <p className="text-sm text-red-600 text-center mt-3">{saveError}</p>
      )}
    </ModalSheet>
  );
}
