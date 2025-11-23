import type { ReactNode, MouseEvent, TouchEvent } from "react";

type SwipeActionsProps = {
  children: ReactNode;
  onEdit: () => void;
};

export default function SwipeActions({ children, onEdit }: SwipeActionsProps) {
  let startY = 0;
  let isScrolling = false;

  const onTouchStart = (e: TouchEvent) => {
    startY = e.touches[0].clientY;
    isScrolling = false;
  };

  const onTouchMove = (e: TouchEvent) => {
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 6) {
      isScrolling = true; // user is scrolling
    }
  };

  const onTouchEnd = () => {
    if (!isScrolling) {
      onEdit(); // treated as a tap
    }
  };

  const onClick = (_e: MouseEvent) => {
    onEdit(); // desktop click
  };

  return (
    <div
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
      style={{ touchAction: "pan-y" }} // Allow natural scrolling
    >
      {children}
    </div>
  );
}
