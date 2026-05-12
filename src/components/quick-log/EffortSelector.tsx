import { Zap } from "lucide-react";

type EffortSelectorProps = {
  value: number | null;
  onChange: (value: number) => void;
};

const EFFORT_LABELS: Record<number, string> = {
  1: "Very easy",
  2: "Easy",
  3: "Moderate",
  4: "Hard",
  5: "Very hard",
};

const ACCENT_CLASS = "text-[#E88359]";

export default function EffortSelector({ value, onChange }: EffortSelectorProps) {
  return (
    <div className="w-full">
      <div className="mb-4">
        <label className="block text-left text-sm font-medium text-[#2C3530]">
          Effort
        </label>
        <p className="mt-2 text-left text-xs text-gray-500">
          How hard was it?
        </p>
      </div>

      <div className="rounded-[1.75rem] bg-[#F7F2EA] px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <div className="flex items-center justify-between gap-2">
          {[1, 2, 3, 4, 5].map((val) => {
            const active = value != null && val <= value;
            return (
              <button
                key={val}
                type="button"
                aria-label={`Effort ${val}: ${EFFORT_LABELS[val]}`}
                aria-pressed={value === val}
                onClick={() => onChange(val)}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 ${
                  value === val ? "scale-105" : ""
                }`}
              >
                <Zap
                  strokeWidth={2.1}
                  className={`h-7 w-7 transition-colors duration-150 ${
                    active ? ACCENT_CLASS : "text-[#C9CFD8]"
                  }`}
                  style={{ transitionDelay: `${(val - 1) * 32}ms` }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-1.5 min-h-[1rem] text-center">
        {value != null ? (
          <p className={`text-xs font-medium ${ACCENT_CLASS}`}>
            {EFFORT_LABELS[value]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
