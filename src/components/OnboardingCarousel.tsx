// src/components/OnboardingCarousel.tsx
import { useState } from "react";
import {
  IconRun,
  IconWalk,
  IconYoga,
  IconCamera,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";

type OnboardingCarouselProps = {
  onComplete: () => void;
  onSkip: () => void;
};

export default function OnboardingCarousel({
  onComplete,
  onSkip,
}: OnboardingCarouselProps) {
  const screens = [
    {
      title: "Welcome to MoveNotes",
      body: "A simple journal for your movement – walks, yoga, runs, rides, and everything in between.",
      Icon: IconRun,
    },
    {
      title: "Movement, not performance",
      body: "Log any activity without pressure. No GPS. No pace. Just how it felt.",
      Icon: IconWalk,
    },
    {
      title: "Quick, simple logging",
      body: "Pick an activity, add distance or duration, and optionally add a note or photo.",
      Icon: IconCamera,
    },
    {
      title: "Reflect through notes",
      body: "Add moments, memories, and photos. Your movement story becomes meaningful over time.",
      Icon: IconYoga,
    },
    {
      title: "Stay motivated",
      body: "Set gentle goals and track simple trends across all your activities.",
      Icon: IconRun,
    },
  ];

  const [index, setIndex] = useState(0);

  const next = () => {
    if (index === screens.length - 1) {
      onComplete();
    } else {
      setIndex(index + 1);
    }
  };

  const prev = () => {
    if (index > 0) setIndex(index - 1);
  };

  const { title, body, Icon } = screens[index];

  return (
    <div className="fixed inset-0 bg-warm-100 flex flex-col items-center justify-between p-6 z-50">
      {/* Skip button */}
      <button
        className="absolute top-4 right-4 text-sm text-gray-500 underline"
        onClick={onSkip}
      >
        Skip
      </button>

      {/* Main icon */}
      <div className="mt-10 flex flex-col items-center">
        <Icon size={72} className="text-movenotes-primary mb-6" />
        <h2 className="text-2xl font-semibold text-gray-900 text-center mb-3">
          {title}
        </h2>
        <p className="text-center text-gray-700 max-w-xs">{body}</p>
      </div>

      {/* Pagination dots */}
      <div className="flex gap-2 my-4">
        {screens.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition ${
              i === index ? "bg-movenotes-primary" : "bg-gray-300"
            }`}
          />
        ))}
      </div>

      {/* Nav buttons */}
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <button
          onClick={prev}
          disabled={index === 0}
          className={`p-2 rounded-full ${
            index === 0 ? "opacity-30" : "bg-warm-200 active:scale-95"
          }`}
        >
          <IconChevronLeft size={20} />
        </button>

        <button
          onClick={next}
          className="px-6 py-3 bg-movenotes-primary text-primary-text rounded-full text-lg font-medium active:scale-95"
        >
          {index === screens.length - 1 ? "Get Started" : "Next"}
        </button>

        <div className="p-2 opacity-0">
          <IconChevronRight size={20} />
        </div>
      </div>
    </div>
  );
}
