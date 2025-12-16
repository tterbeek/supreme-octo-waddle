import { Zap } from "lucide-react";

type EffortSelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

export default function EffortSelector({ value, onChange }: EffortSelectorProps) {
  return (
    <div className="w-full">
      <label className="block text-sm text-gray-600 mb-2 text-center">
        Effort
      </label>
      <div className="flex justify-between w-full max-w-sm mx-auto">
        {[1, 2, 3, 4, 5].map((val) => {
          const active = val <= value;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className={`transition transform active:scale-95 ${
                value === val ? "scale-110" : ""
              }`}
            >
              <Zap
                className={`w-5 h-5 ${
                  active ? "text-movenotes-accent" : "text-gray-300"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
