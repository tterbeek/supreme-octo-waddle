import { IconChevronLeft } from "@tabler/icons-react";

export default function OnboardingControls({ index, total, label, previousLabel, onPrevious, onNext, onSkip }: {
  index: number;
  total: number;
  label: string;
  previousLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return <div className="mx-auto w-full max-w-md">
    <div className="mb-3 flex justify-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <span key={i}
        className={`h-2 w-2 rounded-full ${i === index ? "bg-movenotes-primary" : "bg-gray-300"}`} />)}
    </div>
    <p role="status" className="sr-only">Step {index + 1} of {total}</p>
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
      <button type="button" aria-label={previousLabel} onClick={onPrevious} disabled={index === 0}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-warm-200 disabled:opacity-30">
        <IconChevronLeft size={20} aria-hidden="true" />
      </button>
      <button type="button" onClick={onNext} className="mn-primary w-full max-w-64 justify-self-center">{label}</button>
      <button type="button" onClick={onSkip} className="min-h-11 text-sm text-gray-500 underline">Skip</button>
    </div>
  </div>;
}
