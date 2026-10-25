import ModalSheet from "./ModalSheet";
import OnboardingControls from "./OnboardingControls";
// src/components/OnboardingCarousel.tsx
import { useState } from "react";

import {
  IconRun,
  IconWalk,
  IconCamera,
  IconPlant2,
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
      Icon: IconPlant2,
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
    <ModalSheet title={title} onClose={onSkip} presentation="fullscreen" sheetClassName="[&>.mn-form-body]:flex-1"
      footer={<OnboardingControls index={index} total={screens.length} label={index === screens.length - 1 ? "Get Started" : "Next"}
        previousLabel="Previous welcome screen" onPrevious={prev} onNext={next} onSkip={onSkip} />}>
      {/* Main icon */}
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center">
        <Icon size={72} className="text-movenotes-primary mb-6" />

        <p className="text-center text-gray-700 max-w-xs">{body}</p>
      </div>

    </ModalSheet>
  );
}
