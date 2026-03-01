import { useEffect, useState } from "react";
import { IconChevronLeft } from "@tabler/icons-react";
import ActivityPreferencesPage from "../pages/ActivityPreferencesPage";
import ManageEquipmentPage from "../pages/ManageEquipmentPage";
import MicroAdjustmentCreateModal from "./MicroAdjustmentCreateModal";
import AddGoalModal from "./AddGoalModal";
import { supabase } from "../supabaseClient";
import type { Goal } from "../types";

type OnboardingWizardProps = {
  onComplete: () => void;
  onSkip: () => void;
};

type WizardStep = {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
};

type TinyTweakStepProps = {
  onDone: () => void;
};

function TinyTweakStep({ onDone }: TinyTweakStepProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-6 pb-6">
      <div className="rounded-2xl border border-warm-200 bg-warm-50 px-5 py-6">
        <p className="text-sm text-gray-700">
          Pick a small tweak to focus on for your next sessions. You can change it
          any time.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-full bg-amber-300 border border-amber-400 text-primary-text py-3 text-sm font-semibold"
        >
          Choose a tiny tweak
        </button>
      </div>

      <MicroAdjustmentCreateModal
        open={open}
        onClose={() => setOpen(false)}
        onCompleted={() => {
          setOpen(false);
          onDone();
        }}
      />
    </div>
  );
}

type DirectionStepProps = {
  onDone: () => void;
};

function DirectionStep({ onDone }: DirectionStepProps) {
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  useEffect(() => {
    let active = true;

    const loadGoals = async () => {
      setLoadingGoals(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) {
          setGoals([]);
          setLoadingGoals(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("goals")
        .select("id, user_id, activity_type, metric, period, target, name, updated_at, created_at")
        .eq("user_id", user.id);

      if (!active) return;

      if (error) {
        console.error("[Onboarding] Goals load error:", error.message);
        setGoals([]);
      } else {
        setGoals((data as Goal[]) || []);
      }
      setLoadingGoals(false);
    };

    loadGoals();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="px-6 pb-6">
      <div className="rounded-2xl border border-warm-200 bg-warm-50 px-5 py-6">
        <p className="text-sm text-gray-700">
          Set a longer-term direction to guide your weeks.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={loadingGoals}
          className="mt-4 w-full rounded-full bg-amber-300 border border-amber-400 text-primary-text py-3 text-sm font-semibold disabled:opacity-60"
        >
          {loadingGoals ? "Loading..." : "Set a direction"}
        </button>
      </div>

      {open && (
        <AddGoalModal
          onClose={() => setOpen(false)}
          onAdded={() => {
            setOpen(false);
            onDone();
          }}
          onDuplicate={() => {
            setOpen(false);
            onDone();
          }}
          existingGoals={goals}
        />
      )}
    </div>
  );
}

function FinishStep() {
  return (
    <div className="px-6 pb-6">
      <div className="rounded-2xl border border-warm-200 bg-warm-50 px-5 py-6 text-center">
        <p className="text-base font-semibold text-gray-800">
          You just set up MoveNotes to match your own way of moving.
        </p>
        <p className="text-sm text-gray-600 mt-3">
          You can start logging an activity right away.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Wishing you all the best in your movement practice.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingWizard({
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps: WizardStep[] = [
    {
      id: "activity-preferences",
      title: "Pick your activities",
      description: "Enable what you do, set the order, and choose the default metric.",
      content: <ActivityPreferencesPage embedded />,
    },
    {
      id: "equipment",
      title: "Add equipment you use",
      description: "Shoes, bikes, or anything you track with your activities.",
      content: <ManageEquipmentPage embedded />,
    },
    {
      id: "tiny-tweak",
      title: "Set a tiny tweak",
      description: "A small short-term focus to guide your next sessions.",
      content: <TinyTweakStep onDone={handleNext} />,
    },
    {
      id: "direction",
      title: "Set a longer-term direction",
      description: "Very optional — add a longer-term direction to guide your progress.",
      content: <DirectionStep onDone={handleNext} />,
    },
    {
      id: "finish",
      title: "You’re all set",
      description: "Start logging right away and keep your momentum going.",
      content: <FinishStep />,
    },
  ];

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  function handleNext() {
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }

  function handlePrev() {
    if (isFirst) return;
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  return (
    <div className="fixed inset-0 bg-warm-100 flex flex-col items-center p-6 z-50 overflow-y-auto">
      <button
        type="button"
        className="absolute top-4 right-4 text-sm text-gray-500 underline"
        onClick={onSkip}
      >
        Skip
      </button>

      <div className="w-full max-w-3xl flex flex-col items-center">
        <div className="mt-2 text-center flex-shrink-0">
          <p className="text-xs uppercase tracking-widest text-gray-400">
            Welcome step {stepIndex + 1} of {steps.length}
          </p>
          <h2 className="text-2xl font-semibold text-gray-900 mt-2">
            {step.title}
          </h2>
          <p className="text-sm text-gray-600 mt-2 max-w-xl mx-auto">
            {step.description}
          </p>
        </div>

        <div className="mt-4 w-full pb-4">
          {step.content}
        </div>
      </div>

      <div className="flex gap-2 my-3 flex-shrink-0">
        {steps.map((_, idx) => (
          <div
            key={steps[idx].id}
            className={`h-2 w-2 rounded-full transition ${
              idx === stepIndex ? "bg-movenotes-primary" : "bg-gray-300"
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-3xl grid grid-cols-3 items-center mb-2 flex-shrink-0">
        <button
          type="button"
          onClick={handlePrev}
          disabled={isFirst}
          className={`p-2 rounded-full justify-self-start ${
            isFirst ? "opacity-30" : "bg-warm-200 active:scale-95"
          }`}
          aria-label="Back"
        >
          <IconChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-8 py-3 rounded-full bg-movenotes-primary text-primary-text text-lg font-semibold justify-self-center active:scale-95"
        >
          {isLast ? "Start logging" : "Next"}
        </button>

        <div />
      </div>
    </div>
  );
}
