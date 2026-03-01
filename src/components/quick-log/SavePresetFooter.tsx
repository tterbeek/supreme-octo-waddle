import type { ReactNode } from "react";
import TooltipBubble from "../TooltipBubble";

type SavePresetFooterProps = {
  saveAsPreset: boolean;
  presetName: string;
  showMetricTooltip: boolean;
  metricTooltip: ReactNode;
  onToggleSaveAsPreset: () => void;
  onPresetNameChange: (value: string) => void;
  onPresetNameTouched: () => void;
  onSave: () => void;
  onCloseMetricTooltip: () => void;
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
}: SavePresetFooterProps) {
  return (
    <>
      <div className="mt-6 mb-5 space-y-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={saveAsPreset}
            className="accent-movenotes-primary"
            onChange={onToggleSaveAsPreset}
          />
          <span className="text-sm text-gray-700">
            Save activity for reuse (preset)
          </span>
        </label>

        {saveAsPreset && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Preset name
            </label>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="e.g. Morning 5k loop"
              value={presetName}
              onChange={(e) => {
                onPresetNameChange(e.target.value);
                onPresetNameTouched();
              }}
            />
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={onSave}
          className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
        >
          Save
        </button>

        {showMetricTooltip && (
          <TooltipBubble
            position="top"
            onClose={onCloseMetricTooltip}
          >
            {metricTooltip}
          </TooltipBubble>
        )}
      </div>
    </>
  );
}
