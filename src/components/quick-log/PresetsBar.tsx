import type { Preset } from "../../types";

type PresetsBarProps = {
  presets: Preset[];
  activePreset: Preset | null;
  onSelectPreset: (preset: Preset) => void;
  onSelectCustom: () => void;
  onOpenMore: () => void;
};

export default function PresetsBar({
  presets,
  activePreset,
  onSelectPreset,
  onSelectCustom,
  onOpenMore,
}: PresetsBarProps) {
  const maxVisible = 3;
  const visiblePresets = presets.slice(0, maxVisible);
  const hasMore = presets.length > maxVisible;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={onSelectCustom}
        aria-pressed={activePreset === null}
        className={`max-w-full px-3 py-2 rounded-full text-sm border transition ${
          activePreset === null
            ? "bg-amber-50 border-amber-300 text-gray-800"
            : "border-gray-300 text-gray-600"
        }`}
      >
        Custom
      </button>

      {visiblePresets.map((p) => (
        <button
          key={p.id}
          aria-pressed={activePreset?.id === p.id}
          onClick={() => onSelectPreset(p)}
          className={`max-w-full px-3 py-2 rounded-full text-sm border transition ${
            activePreset?.id === p.id
              ? "bg-amber-300 border-amber-400 text-primary-text"
              : "border-gray-300 text-gray-600"
          }`}
        >
          {p.name}
        </button>
      ))}

      {hasMore && (
        <button
          onClick={onOpenMore}
          className="px-3 py-2 rounded-full text-sm border border-gray-300 text-gray-600"
        >
          More…
        </button>
      )}
    </div>
  );
}
