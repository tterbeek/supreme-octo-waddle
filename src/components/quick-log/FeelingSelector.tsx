import { Frown, Meh, Smile, Laugh } from "lucide-react";

type FeelingSelectorProps = {
  value: number | null;
  onChange: (value: number) => void;
};

export default function FeelingSelector({ value, onChange }: FeelingSelectorProps) {
  return (
    <div className="w-full">
      <label className="block text-sm text-gray-600 mb-2 text-center">
        Feeling
      </label>
      {value == null && (
        <p className="mb-2 text-center text-xs text-gray-500">
          Tap one to choose
        </p>
      )}
      <div className="flex justify-between w-full max-w-sm mx-auto">
        {[
          { Icon: Frown, value: 1 },
          { Icon: Meh, value: 2 },
          { Icon: Smile, value: 3 },
          { Icon: Laugh, value: 4 },
        ].map(({ Icon, value: val }) => {
          const active = value === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className={`transition transform active:scale-95 ${
                active ? "scale-110" : "opacity-70"
              }`}
            >
              <Icon
                className={`w-7 h-7 ${
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
