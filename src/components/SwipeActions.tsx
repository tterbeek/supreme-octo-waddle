import type { ReactNode, MouseEvent, TouchEvent } from "react";

type SwipeActionsProps = {
  children: ReactNode;
  onEdit: () => void;
  disabled?: boolean;
};

export default function SwipeActions({
  children,
  onEdit,
  disabled,
}: SwipeActionsProps) {
  let startY = 0;
  let isScrolling = false;
  let startedOnInteractive = false;

  const isInteractiveTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(
      el.closest(
        [
          "button",
          "a",
          "input",
          "textarea",
          "select",
          "[role='button']",
          "[data-photo-trigger]",
          "[data-swipe-ignore]",
        ].join(",")
      )
    );
  };

  const onTouchStart = (e: TouchEvent) => {
    e.stopPropagation();
    startedOnInteractive = isInteractiveTarget(e.target);
    startY = e.touches[0].clientY;
    isScrolling = false;
  };

  const onTouchMove = (e: TouchEvent) => {
    e.stopPropagation();
    if (startedOnInteractive) return;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 6) {
      isScrolling = true; // user is scrolling
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    e.stopPropagation();
    if (startedOnInteractive) return;
    e.preventDefault(); // prevent follow-up synthetic click from bubbling to overlays
    if (!isScrolling) {
      onEdit(); // treated as a tap
    }
  };

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (isInteractiveTarget(e.target)) return;
    onEdit(); // desktop click
  };

  return (
    <div
      onClick={disabled ? undefined : onClick}
      onTouchStart={disabled ? undefined : onTouchStart}
      onTouchMove={disabled ? undefined : onTouchMove}
      onTouchEnd={disabled ? undefined : onTouchEnd}
      className="relative"
      style={{ touchAction: "pan-y" }} // Allow natural scrolling
    >
      {children}
    </div>
  );
}
