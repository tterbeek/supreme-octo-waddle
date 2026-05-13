import {
  Frown,
  Laugh,
  Meh,
  Smile,
  type LucideIcon,
} from "lucide-react";
import { IconMoodSpark } from "@tabler/icons-react";
import type { FeelingAfter, FeelingDuring } from "../../lib/feelings";

type FeelingPhasesSelectorProps = {
  during: FeelingDuring | null;
  after: FeelingAfter | null;
  onDuringChange: (value: FeelingDuring) => void;
  onAfterChange: (value: FeelingAfter) => void;
};

type Option<T extends string> = {
  value: T;
  label: string;
  Icon: LucideIcon | typeof IconMoodSpark;
};

const DURING_OPTIONS: Option<FeelingDuring>[] = [
  { value: "sad", label: "Struggling", Icon: Frown },
  { value: "neutral", label: "Neutral", Icon: Meh },
  { value: "smile", label: "Flowing", Icon: Smile },
  { value: "happy", label: "Energized", Icon: Laugh },
];

const AFTER_OPTIONS: Option<FeelingAfter>[] = [
  { value: "sad", label: "Drained", Icon: Frown },
  { value: "smile", label: "Relaxed", Icon: Smile },
  { value: "happy", label: "Good", Icon: Laugh },
  { value: "spark", label: "Uplifted", Icon: IconMoodSpark },
];

const ACCENT_CLASS = "text-[#E88359]";

function FeelingRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const selectedOption = options.find((option) => option.value === value);
  const selectedIndex = value == null ? -1 : options.findIndex((option) => option.value === value);

  return (
    <div className="grid gap-1.5 md:grid-cols-[6.5rem_minmax(0,1fr)] md:gap-2 md:items-start">
      <div className="pt-1.5">
        <div className="text-left text-sm text-gray-600">
          {label} <span className="text-[11px] text-gray-400/90">{hint}</span>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-4 gap-3">
          {options.map(({ value: optionValue, Icon }) => {
            const active = value === optionValue;

            return (
              <button
                key={optionValue}
                type="button"
                onClick={() => onChange(optionValue)}
                className={`rounded-2xl border px-2 py-3 text-center transition duration-150 active:scale-[0.98] ${
                  active
                    ? "scale-[1.06] border-[#EEDFD2] bg-[#FBF4EE] shadow-[0_0_0_1px_rgba(238,223,210,0.45)]"
                    : "border-[#F1ECE5] bg-[#FCFAF7]"
                }`}
              >
                <div className="flex justify-center">
                  <Icon
                    className={`h-8 w-8 transition-all duration-150 ${
                      active ? `${ACCENT_CLASS} scale-[1.08]` : "text-[#9EA8B5]"
                    }`}
                    strokeWidth={1.8}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid min-h-2 grid-cols-4 gap-3">
          {selectedOption ? (
            <div
              className="flex justify-center"
              style={{ gridColumnStart: selectedIndex + 1 }}
            >
              <p className={`text-xs font-medium ${ACCENT_CLASS}`}>
                {selectedOption.label}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function FeelingPhasesSelector({
  during,
  after,
  onDuringChange,
  onAfterChange,
}: FeelingPhasesSelectorProps) {
  return (
    <div className="w-full">
      <div className="mb-2">
        <label className="block text-left text-sm font-medium text-[#2C3530]">
          How did it feel?
        </label>
      </div>

      <div>
        <FeelingRow
          label="During"
          hint="in the moment"
          value={during}
          options={DURING_OPTIONS}
          onChange={onDuringChange}
        />
        <FeelingRow
          label="After"
          hint="how it left you"
          value={after}
          options={AFTER_OPTIONS}
          onChange={onAfterChange}
        />
      </div>
    </div>
  );
}
