import { useId, type ReactNode } from "react";
import TooltipBubble from "../TooltipBubble";

type SavePresetFooterProps = {
  saveAsPreset: boolean;
  presetName: string;
  showMetricTooltip?: boolean;
  metricTooltip?: ReactNode;
  onToggleSaveAsPreset: () => void;
  onPresetNameChange: (value: string) => void;
  onPresetNameTouched?: () => void;
  onSave?: () => void;
  onCloseMetricTooltip?: () => void;
  className?: string;
  hideSave?: boolean;
};

export default function SavePresetFooter({
  saveAsPreset,
  presetName,
  showMetricTooltip,
  metricTooltip,
  onToggleSaveAsPreset,
  onPresetNameChange,
  onPresetNameTouched,
  onSave,
  onCloseMetricTooltip,
  className = "mt-6 mb-5 space-y-3",
  hideSave = false,
}: SavePresetFooterProps) {
  const presetNameId = useId();
  const labelId = useId();
  return (
    <>
      <div className={className}>
        <div className="flex items-center justify-between gap-3">
          <span id={labelId} className="text-sm text-gray-700">
            Save activity as preset
          </span>
          <button type="button" role="switch" aria-labelledby={labelId} aria-checked={saveAsPreset}
            onClick={onToggleSaveAsPreset}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ml-auto ${saveAsPreset ? "bg-movenotes-primary/70" : "bg-gray-300/70"}`}>
            <span aria-hidden="true" className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${saveAsPreset ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        </div>

        {saveAsPreset && (
          <div>
            <label htmlFor={presetNameId} className="block text-xs text-gray-500 mb-1">
              Preset name
            </label>
            <input
              id={presetNameId}
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="e.g. Morning 5k loop"
              value={presetName}
              onChange={(e) => {
                onPresetNameChange(e.target.value);
                onPresetNameTouched?.();
              }}
            />
          </div>
        )}
      </div>

      {!hideSave && onSave && <div className="relative">
        <button
          onClick={onSave}
          className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
        >
          Save
        </button>

        {showMetricTooltip && (
          <TooltipBubble
            position="top"
            onClose={() => onCloseMetricTooltip?.()}
          >
            {metricTooltip}
          </TooltipBubble>
        )}
      </div>}
    </>
  );
}
